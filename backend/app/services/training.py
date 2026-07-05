from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import func, case
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import AppException
from app.models.training import (
    GoalType,
    UnitType,
    TemplateStatus,
    SessionStatus,
    SessionItemStatus,
    RestEndType,
    TrainingTemplate,
    TrainingTemplateUnit,
    TrainingSession,
    TrainingSessionUnit,
    TrainingSessionItem,
    TrainingRestRecord,
)
from app.schemas.training import TemplateCreate, TemplateUpdate


_FINISHED_ITEM_STATUSES = {SessionItemStatus.completed.value, SessionItemStatus.skipped.value}


def _now() -> datetime:
    # Naive UTC to match MySQL DATETIME column reads (DB strips tz info).
    return datetime.utcnow()


def _to_naive_utc(dt: datetime) -> datetime:
    """Normalize any datetime to naive UTC, matching MySQL DATETIME reads."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    return dt.replace(tzinfo=None)


def _template_or_404(db: Session, template_id: str, user_id: str) -> TrainingTemplate:
    template = db.query(TrainingTemplate).filter(
        TrainingTemplate.id == template_id,
        TrainingTemplate.user_id == user_id,
    ).first()
    if not template:
        raise AppException(40401, "模板不存在")
    return template


def _session_or_404(db: Session, session_id: str, user_id: str) -> TrainingSession:
    session = db.query(TrainingSession).filter(
        TrainingSession.id == session_id,
        TrainingSession.user_id == user_id,
    ).first()
    if not session:
        raise AppException(40402, "训练记录不存在")
    return session


def _item_or_404(db: Session, item_id: str, session_id: str, user_id: str) -> TrainingSessionItem:
    item = db.query(TrainingSessionItem).filter(
        TrainingSessionItem.id == item_id,
        TrainingSessionItem.session_id == session_id,
        TrainingSessionItem.user_id == user_id,
    ).first()
    if not item:
        raise AppException(40403, "训练动作不存在")
    return item


def _rest_or_404(db: Session, rest_id: str, session_id: str, user_id: str) -> TrainingRestRecord:
    rest = db.query(TrainingRestRecord).filter(
        TrainingRestRecord.id == rest_id,
        TrainingRestRecord.session_id == session_id,
        TrainingRestRecord.user_id == user_id,
    ).first()
    if not rest:
        raise AppException(40404, "休息记录不存在")
    return rest


def _unit_order_map(session: TrainingSession) -> dict:
    return {u.id: u.sort_order for u in session.units}


def _sort_items(items: list[TrainingSessionItem], order_map: dict) -> list[TrainingSessionItem]:
    def key(item: TrainingSessionItem):
        return (
            order_map.get(item.session_unit_id, 0),
            item.round_index,
            item.set_index,
            item.segment_index,
            item.created_at or datetime.min.replace(tzinfo=timezone.utc),
        )
    return sorted(items, key=key)


def _next_unfinished_item(
    session: TrainingSession,
    after_item_id: Optional[str] = None,
) -> Optional[TrainingSessionItem]:
    order_map = _unit_order_map(session)
    all_sorted = _sort_items(session.items, order_map)
    if not after_item_id:
        for item in all_sorted:
            if item.status not in _FINISHED_ITEM_STATUSES:
                return item
        return None

    found = False
    for item in all_sorted:
        if found and item.status not in _FINISHED_ITEM_STATUSES:
            return item
        if item.id == after_item_id:
            found = True
    return None


def _get_session_unit(session: TrainingSession, unit_id: str) -> Optional[TrainingSessionUnit]:
    return next((u for u in session.units if u.id == unit_id), None)


def _round_unfinished(session: TrainingSession, item: TrainingSessionItem) -> list:
    return [
        i for i in session.items
        if i.session_unit_id == item.session_unit_id
        and i.round_index == item.round_index
        and i.status not in _FINISHED_ITEM_STATUSES
        and i.id != item.id
    ]


def _should_start_rest(
    session: TrainingSession,
    item: TrainingSessionItem,
    next_item: Optional[TrainingSessionItem],
) -> tuple[bool, int]:
    if not next_item:
        return False, 0

    unit = _get_session_unit(session, item.session_unit_id)
    if not unit:
        return (item.target_rest_seconds or 0) > 0, item.target_rest_seconds or 0

    unit_type = unit.unit_type
    if unit_type == UnitType.normal.value:
        return (item.target_rest_seconds or 0) > 0, item.target_rest_seconds or 0

    if unit_type in (UnitType.superset.value, UnitType.dropset.value):
        if _round_unfinished(session, item):
            return False, 0
        rest_seconds = item.target_rest_seconds or 0
        return rest_seconds > 0, rest_seconds

    return (item.target_rest_seconds or 0) > 0, item.target_rest_seconds or 0


def _apply_after_item(
    session: TrainingSession,
    item: TrainingSessionItem,
    next_item: Optional[TrainingSessionItem],
    completed_at: datetime,
) -> Optional[TrainingRestRecord]:
    if next_item:
        session.current_item_id = next_item.id
        session.current_unit_id = next_item.session_unit_id
    else:
        session.current_item_id = None
        session.current_unit_id = None

    should_rest, rest_seconds = _should_start_rest(session, item, next_item)
    if should_rest:
        rest_record = TrainingRestRecord(
            session_id=session.id,
            user_id=session.user_id,
            related_item_id=item.id,
            planned_rest_seconds=rest_seconds,
            rest_start_time=completed_at,
            rest_target_end_time=completed_at + timedelta(seconds=rest_seconds),
        )
        session.session_status = SessionStatus.resting.value
        return rest_record

    session.session_status = SessionStatus.in_progress.value
    return None


def _current_active_rest(session: TrainingSession) -> Optional[TrainingRestRecord]:
    active = [r for r in session.rest_records if r.rest_actual_end_time is None]
    if not active:
        return None
    for r in active:
        if session.current_item_id and r.related_item_id == session.current_item_id:
            return r
    return max(active, key=lambda r: r.rest_start_time)


# ---------- Template services ----------

def create_template(db: Session, user_id: str, payload: TemplateCreate) -> TrainingTemplate:
    template = TrainingTemplate(
        user_id=user_id,
        template_name=payload.template_name,
        description=payload.description,
        goal_type=payload.goal_type.value if payload.goal_type else GoalType.other.value,
        status=TemplateStatus.active.value,
    )
    db.add(template)
    db.flush()

    for idx, unit_payload in enumerate(payload.units):
        unit = TrainingTemplateUnit(
            template_id=template.id,
            user_id=user_id,
            unit_type=unit_payload.unit_type.value,
            unit_name=unit_payload.unit_name,
            sort_order=unit_payload.sort_order if unit_payload.sort_order is not None else idx,
            config_json=unit_payload.config.model_dump(),
        )
        db.add(unit)

    db.commit()
    db.refresh(template)
    return template


def list_templates(db: Session, user_id: str) -> list:
    unit_count_subq = (
        db.query(
            TrainingTemplateUnit.template_id,
            func.count(TrainingTemplateUnit.id).label("unit_count"),
        )
        .group_by(TrainingTemplateUnit.template_id)
        .subquery()
    )

    rows = (
        db.query(
            TrainingTemplate,
            func.coalesce(unit_count_subq.c.unit_count, 0).label("unit_count"),
        )
        .outerjoin(unit_count_subq, TrainingTemplate.id == unit_count_subq.c.template_id)
        .filter(
            TrainingTemplate.user_id == user_id,
            TrainingTemplate.status == TemplateStatus.active.value,
        )
        .order_by(
            case((TrainingTemplate.last_used_at.is_(None), 1), else_=0),
            TrainingTemplate.last_used_at.desc(),
            TrainingTemplate.created_at.desc(),
        )
        .all()
    )
    return rows


def get_template_detail(db: Session, template_id: str, user_id: str) -> TrainingTemplate:
    template = _template_or_404(db, template_id, user_id)
    template.units = sorted(template.units, key=lambda u: (u.sort_order, u.created_at))
    return template


def update_template(
    db: Session,
    template_id: str,
    user_id: str,
    payload: TemplateUpdate,
) -> TrainingTemplate:
    template = _template_or_404(db, template_id, user_id)

    if payload.template_name is not None:
        template.template_name = payload.template_name
    if payload.description is not None:
        template.description = payload.description
    if payload.goal_type is not None:
        template.goal_type = payload.goal_type.value

    # Replace units.
    db.query(TrainingTemplateUnit).filter(
        TrainingTemplateUnit.template_id == template.id
    ).delete(synchronize_session=False)

    for idx, unit_payload in enumerate(payload.units):
        unit = TrainingTemplateUnit(
            template_id=template.id,
            user_id=user_id,
            unit_type=unit_payload.unit_type.value,
            unit_name=unit_payload.unit_name,
            sort_order=unit_payload.sort_order if unit_payload.sort_order is not None else idx,
            config_json=unit_payload.config.model_dump(),
        )
        db.add(unit)

    db.commit()
    db.refresh(template)
    template.units = sorted(template.units, key=lambda u: (u.sort_order, u.created_at))
    return template


def delete_template(db: Session, template_id: str, user_id: str) -> TrainingTemplate:
    template = _template_or_404(db, template_id, user_id)
    template.status = TemplateStatus.deleted.value
    db.commit()
    db.refresh(template)
    return template


# ---------- Session services ----------

def start_session(
    db: Session,
    user_id: str,
    template_id: str,
    start_time: datetime,
) -> TrainingSession:
    template = _template_or_404(db, template_id, user_id)
    if template.status != TemplateStatus.active.value:
        raise AppException(40002, "模板已删除")

    unfinished = db.query(TrainingSession).filter(
        TrainingSession.user_id == user_id,
        TrainingSession.session_status.in_([
            SessionStatus.draft.value,
            SessionStatus.in_progress.value,
            SessionStatus.resting.value,
        ]),
    ).first()
    if unfinished:
        raise AppException(42001, "存在未完成的训练")

    start_time = _to_naive_utc(start_time)
    session = TrainingSession(
        user_id=user_id,
        template_id=template.id,
        template_name_snapshot=template.template_name,
        session_status=SessionStatus.in_progress.value,
        start_time=start_time,
        current_unit_id=None,
        current_item_id=None,
    )
    db.add(session)
    db.flush()

    session_units: list[TrainingSessionUnit] = []
    for t_unit in sorted(template.units, key=lambda u: (u.sort_order, u.created_at)):
        s_unit = TrainingSessionUnit(
            session_id=session.id,
            user_id=user_id,
            unit_type=t_unit.unit_type,
            unit_name=t_unit.unit_name,
            sort_order=t_unit.sort_order,
        )
        db.add(s_unit)
        session_units.append(s_unit)

    db.flush()

    sorted_units = sorted(template.units, key=lambda u: (u.sort_order, u.created_at))
    unit_map = {t_unit.id: s_unit for t_unit, s_unit in zip(sorted_units, session_units)}

    created_items: list[TrainingSessionItem] = []
    for t_unit in sorted_units:
        s_unit = unit_map[t_unit.id]
        config = t_unit.config_json or {}
        unit_type = t_unit.unit_type

        if unit_type == UnitType.normal.value:
            exercise_name = config.get("exercise_name", "")
            for s in config.get("sets", []):
                item = TrainingSessionItem(
                    session_id=session.id,
                    session_unit_id=s_unit.id,
                    user_id=user_id,
                    exercise_name=exercise_name,
                    round_index=0,
                    set_index=s.get("set_index", 0),
                    segment_index=0,
                    target_weight=s.get("target_weight", 0),
                    target_reps=s.get("target_reps", 0),
                    target_rest_seconds=s.get("target_rest_seconds", 0),
                    status=SessionItemStatus.not_started.value,
                )
                db.add(item)
                created_items.append(item)

        elif unit_type == UnitType.superset.value:
            rounds = config.get("rounds", 1)
            for r in range(1, rounds + 1):
                for ex in config.get("exercises", []):
                    item = TrainingSessionItem(
                        session_id=session.id,
                        session_unit_id=s_unit.id,
                        user_id=user_id,
                        exercise_name=ex.get("exercise_name", ""),
                        round_index=r,
                        set_index=0,
                        segment_index=0,
                        target_weight=ex.get("target_weight", 0),
                        target_reps=ex.get("target_reps", 0),
                        target_rest_seconds=config.get("target_rest_seconds", 0),
                        status=SessionItemStatus.not_started.value,
                    )
                    db.add(item)
                    created_items.append(item)

        elif unit_type == UnitType.dropset.value:
            rounds = config.get("rounds", 1)
            exercise_name = config.get("exercise_name", "")
            for r in range(1, rounds + 1):
                for seg in config.get("segments", []):
                    item = TrainingSessionItem(
                        session_id=session.id,
                        session_unit_id=s_unit.id,
                        user_id=user_id,
                        exercise_name=exercise_name,
                        round_index=r,
                        set_index=0,
                        segment_index=seg.get("segment_index", 0),
                        target_weight=seg.get("target_weight", 0),
                        target_reps=seg.get("target_reps", 0),
                        target_rest_seconds=config.get("target_rest_seconds", 0),
                        status=SessionItemStatus.not_started.value,
                    )
                    db.add(item)
                    created_items.append(item)

    if created_items:
        order_map = {u.id: u.sort_order for u in session_units}
        first_item = _sort_items(created_items, order_map)[0]
        session.current_item_id = first_item.id
        session.current_unit_id = first_item.session_unit_id

    template.last_used_at = start_time
    db.commit()
    db.refresh(session)
    return session


def get_unfinished_session(db: Session, user_id: str) -> Optional[TrainingSession]:
    return db.query(TrainingSession).filter(
        TrainingSession.user_id == user_id,
        TrainingSession.session_status.in_([
            SessionStatus.draft.value,
            SessionStatus.in_progress.value,
            SessionStatus.resting.value,
        ]),
    ).order_by(TrainingSession.created_at.desc()).first()


def get_session_with_units_items(db: Session, session_id: str, user_id: str) -> TrainingSession:
    session = (
        db.query(TrainingSession)
        .options(
            selectinload(TrainingSession.units),
            selectinload(TrainingSession.items),
            selectinload(TrainingSession.rest_records),
        )
        .filter(
            TrainingSession.id == session_id,
            TrainingSession.user_id == user_id,
        )
        .first()
    )
    if not session:
        raise AppException(40402, "训练记录不存在")
    session.units = sorted(session.units, key=lambda u: (u.sort_order, u.created_at))
    session.items = sorted(
        session.items,
        key=lambda i: (
            {u.id: u.sort_order for u in session.units}.get(i.session_unit_id, 0),
            i.round_index,
            i.set_index,
            i.segment_index,
            i.created_at or datetime.min.replace(tzinfo=timezone.utc),
        ),
    )
    return session


def complete_session_item(
    db: Session,
    session_id: str,
    item_id: str,
    user_id: str,
    actual_weight: float,
    actual_reps: int,
    completed_at: datetime,
) -> tuple[Optional[TrainingSessionItem], Optional[TrainingRestRecord]]:
    session = _session_or_404(db, session_id, user_id)
    item = _item_or_404(db, item_id, session_id, user_id)

    completed_at = _to_naive_utc(completed_at)
    item.status = SessionItemStatus.completed.value
    item.actual_weight = actual_weight
    item.actual_reps = actual_reps
    item.completed_at = completed_at

    next_item = _next_unfinished_item(session, item.id)

    rest_record = _apply_after_item(session, item, next_item, completed_at)
    if rest_record:
        db.add(rest_record)

    db.commit()
    db.refresh(session)
    return next_item, rest_record


def skip_session_item(
    db: Session,
    session_id: str,
    item_id: str,
    user_id: str,
) -> tuple[Optional[TrainingSessionItem], Optional[TrainingRestRecord]]:
    session = _session_or_404(db, session_id, user_id)
    item = _item_or_404(db, item_id, session_id, user_id)

    item.status = SessionItemStatus.skipped.value

    next_item = _next_unfinished_item(session, item.id)
    now = _now()
    rest_record = _apply_after_item(session, item, next_item, now)
    if rest_record:
        db.add(rest_record)

    db.commit()
    db.refresh(session)
    return next_item, rest_record


def skip_rest(
    db: Session,
    session_id: str,
    rest_id: str,
    user_id: str,
) -> tuple[TrainingRestRecord, Optional[TrainingSessionItem]]:
    session = _session_or_404(db, session_id, user_id)
    rest = _rest_or_404(db, rest_id, session_id, user_id)

    now = _now()
    rest.rest_actual_end_time = max(rest.rest_start_time, now)
    rest.actual_rest_seconds = max(0, int((rest.rest_actual_end_time - rest.rest_start_time).total_seconds()))
    rest.end_type = RestEndType.skipped.value

    session.session_status = SessionStatus.in_progress.value
    if not session.current_item_id:
        # Fallback: advance past the related item.
        next_item = _next_unfinished_item(session, rest.related_item_id)
        if next_item:
            session.current_item_id = next_item.id
            session.current_unit_id = next_item.session_unit_id

    db.commit()
    db.refresh(session)
    current_item = None
    if session.current_item_id:
        current_item = next((i for i in session.items if i.id == session.current_item_id), None)
    return rest, current_item


def complete_rest(
    db: Session,
    session_id: str,
    rest_id: str,
    user_id: str,
) -> TrainingRestRecord:
    session = _session_or_404(db, session_id, user_id)
    rest = _rest_or_404(db, rest_id, session_id, user_id)

    now = _now()
    rest.rest_actual_end_time = max(rest.rest_start_time, now)
    rest.actual_rest_seconds = max(0, int((rest.rest_actual_end_time - rest.rest_start_time).total_seconds()))
    rest.end_type = RestEndType.natural_end.value
    session.session_status = SessionStatus.in_progress.value

    db.commit()
    db.refresh(rest)
    return rest


def extend_rest(
    db: Session,
    session_id: str,
    rest_id: str,
    user_id: str,
    additional_seconds: int,
) -> TrainingRestRecord:
    session = _session_or_404(db, session_id, user_id)
    rest = _rest_or_404(db, rest_id, session_id, user_id)

    rest.rest_target_end_time = rest.rest_target_end_time + timedelta(seconds=additional_seconds)
    rest.end_type = RestEndType.extended.value

    db.commit()
    db.refresh(rest)
    return rest


def add_temporary_set(
    db: Session,
    session_id: str,
    user_id: str,
    session_unit_id: str,
    based_on_item_id: str,
    target_weight: float,
    target_reps: int,
    target_rest_seconds: int,
) -> TrainingSessionItem:
    session = _session_or_404(db, session_id, user_id)
    session_unit = db.query(TrainingSessionUnit).filter(
        TrainingSessionUnit.id == session_unit_id,
        TrainingSessionUnit.session_id == session.id,
        TrainingSessionUnit.user_id == user_id,
    ).first()
    if not session_unit:
        raise AppException(40405, "训练单元不存在")
    if session_unit.unit_type != UnitType.normal.value:
        raise AppException(40003, "仅普通组可添加临时组")

    base_item = _item_or_404(db, based_on_item_id, session_id, user_id)

    max_set_index = (
        db.query(func.max(TrainingSessionItem.set_index))
        .filter(
            TrainingSessionItem.session_unit_id == session_unit_id,
            TrainingSessionItem.round_index == 0,
            TrainingSessionItem.segment_index == 0,
        )
        .scalar()
    ) or 0

    new_item = TrainingSessionItem(
        session_id=session.id,
        session_unit_id=session_unit_id,
        user_id=user_id,
        exercise_name=base_item.exercise_name,
        round_index=0,
        set_index=max_set_index + 1,
        segment_index=0,
        target_weight=target_weight,
        target_reps=target_reps,
        target_rest_seconds=target_rest_seconds,
        status=SessionItemStatus.not_started.value,
        is_temporary_added=True,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


def finish_session(
    db: Session,
    session_id: str,
    user_id: str,
    finish_type: SessionStatus,
    end_time: datetime,
) -> TrainingSession:
    session = get_session_with_units_items(db, session_id, user_id)

    end_time = _to_naive_utc(end_time)

    now = _now()
    rest_close_time = min(now, end_time) if end_time else now
    for rest in session.rest_records:
        if rest.rest_actual_end_time is None:
            # 防服务端时钟漂移：保证 close_time >= start_time
            close_at = max(rest.rest_start_time, rest_close_time)
            rest.rest_actual_end_time = close_at
            delta = (close_at - rest.rest_start_time).total_seconds()
            rest.actual_rest_seconds = max(0, int(delta))
            rest.end_type = RestEndType.skipped.value

    session.session_status = finish_type.value
    session.end_time = end_time
    if session.start_time:
        session.duration_seconds = int((end_time - session.start_time).total_seconds())

    if finish_type != SessionStatus.abandoned:
        for item in session.items:
            if item.status not in _FINISHED_ITEM_STATUSES:
                item.status = SessionItemStatus.unfinished.value

    db.commit()
    db.refresh(session)
    return session


def list_session_history(
    db: Session,
    user_id: str,
    page: int,
    page_size: int,
) -> tuple[list, int]:
    completed_subq = (
        db.query(
            TrainingSessionItem.session_id,
            func.count(TrainingSessionItem.id).label("cnt"),
        )
        .filter(TrainingSessionItem.user_id == user_id)
        .filter(TrainingSessionItem.status == SessionItemStatus.completed.value)
        .group_by(TrainingSessionItem.session_id)
        .subquery()
    )
    skipped_subq = (
        db.query(
            TrainingSessionItem.session_id,
            func.count(TrainingSessionItem.id).label("cnt"),
        )
        .filter(TrainingSessionItem.user_id == user_id)
        .filter(TrainingSessionItem.status == SessionItemStatus.skipped.value)
        .group_by(TrainingSessionItem.session_id)
        .subquery()
    )

    base_query = db.query(TrainingSession).filter(
        TrainingSession.user_id == user_id,
        TrainingSession.session_status.in_([
            SessionStatus.completed.value,
            SessionStatus.interrupted_saved.value,
        ]),
    )

    total = base_query.count()

    rows = (
        base_query
        .add_columns(
            func.coalesce(completed_subq.c.cnt, 0).label("completed_count"),
            func.coalesce(skipped_subq.c.cnt, 0).label("skipped_count"),
        )
        .outerjoin(completed_subq, TrainingSession.id == completed_subq.c.session_id)
        .outerjoin(skipped_subq, TrainingSession.id == skipped_subq.c.session_id)
        .order_by(
            case(
                (TrainingSession.end_time.is_(None), 1),
                else_=0
            ),
            TrainingSession.end_time.desc()
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, total


def copy_last_session_template(db: Session, user_id: str) -> TrainingTemplate:
    last_session = (
        db.query(TrainingSession)
        .filter(
            TrainingSession.user_id == user_id,
            TrainingSession.session_status.in_([
                SessionStatus.completed.value,
                SessionStatus.interrupted_saved.value,
            ]),
        )
        .order_by(TrainingSession.end_time.desc())
        .first()
    )
    if not last_session or not last_session.template_id:
        raise AppException(40004, "暂无已完成训练可复制")

    source = get_template_detail(db, last_session.template_id, user_id)
    from app.schemas.training import TemplateCreate, TemplateUnitCreate

    units_payload = []
    for u in sorted(source.units, key=lambda x: (x.sort_order, x.created_at)):
        config = dict(u.config_json or {})
        config["unit_type"] = u.unit_type
        units_payload.append(
            TemplateUnitCreate(
                unit_type=UnitType(u.unit_type),
                unit_name=u.unit_name,
                sort_order=u.sort_order,
                config=config,
            )
        )
    payload = TemplateCreate(
        template_name=f"{last_session.template_name_snapshot} 副本",
        description=source.description,
        goal_type=GoalType(source.goal_type) if source.goal_type else GoalType.other,
        units=units_payload,
    )
    return create_template(db, user_id, payload)
