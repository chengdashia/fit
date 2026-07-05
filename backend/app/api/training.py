from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.response import success_response, paginated_list
from app.models.training import SessionStatus
from app.models.user import UserAccount
from app.schemas import training as schemas
from app.services import training as training_service

router = APIRouter()


def _sort_session_items(session):
    session.units = sorted(session.units, key=lambda u: (u.sort_order, u.created_at))
    order_map = {u.id: u.sort_order for u in session.units}
    session.items = sorted(
        session.items,
        key=lambda i: (
            order_map.get(i.session_unit_id, 0),
            i.round_index,
            i.set_index,
            i.segment_index,
            i.created_at or datetime.min.replace(tzinfo=timezone.utc),
        ),
    )
    return session


def _serialize_session_item(item):
    if not item:
        return None
    return schemas.SessionItemResponse.model_validate(item).model_dump()


def _serialize_rest_record(rest):
    if not rest:
        return None
    return schemas.RestRecordResponse.model_validate(rest).model_dump()


def _session_response(session):
    session = _sort_session_items(session)
    data = schemas.SessionResponse.model_validate(session).model_dump()
    current_item = next(
        (i for i in session.items if i.id == session.current_item_id), None
    )
    data["current_item"] = _serialize_session_item(current_item)
    data["active_rest_record"] = _serialize_rest_record(
        training_service._current_active_rest(session)
    )
    return data


# ---------- Templates ----------

@router.post("/templates")
def create_template(
    payload: schemas.TemplateCreate,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    template = training_service.create_template(db, current_user.user_id, payload)
    return success_response(
        schemas.TemplateDetailResponse.model_validate(template).model_dump()
    )


@router.get("/templates")
def list_templates(
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    rows = training_service.list_templates(db, current_user.user_id)
    items = []
    for template, unit_count in rows:
        base = schemas.TemplateListItem.model_validate(template).model_dump()
        base["unit_count"] = unit_count or 0
        items.append(base)
    return success_response(items)


@router.get("/templates/{template_id}")
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    template = training_service.get_template_detail(db, template_id, current_user.user_id)
    return success_response(
        schemas.TemplateDetailResponse.model_validate(template).model_dump()
    )


@router.put("/templates/{template_id}")
def update_template(
    template_id: str,
    payload: schemas.TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    template = training_service.update_template(
        db, template_id, current_user.user_id, payload
    )
    return success_response(
        schemas.TemplateDetailResponse.model_validate(template).model_dump()
    )


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    template = training_service.delete_template(db, template_id, current_user.user_id)
    return success_response(
        schemas.TemplateDetailResponse.model_validate(template).model_dump()
    )


@router.post("/templates/copy-last-session")
def copy_last_session_template(
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    template = training_service.copy_last_session_template(db, current_user.user_id)
    return success_response(
        schemas.TemplateDetailResponse.model_validate(template).model_dump()
    )


# ---------- Sessions ----------

@router.post("/sessions/start")
def start_session(
    payload: schemas.StartSessionRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    session = training_service.start_session(
        db, current_user.user_id, payload.template_id, payload.start_time
    )
    return success_response(_session_response(session))


@router.get("/sessions/unfinished")
def get_unfinished_session(
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    session = training_service.get_unfinished_session(db, current_user.user_id)
    return success_response(_session_response(session) if session else None)


@router.get("/sessions/history")
def session_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    rows, total = training_service.list_session_history(
        db, current_user.user_id, page, page_size
    )
    items = []
    for session, completed_count, skipped_count in rows:
        base = schemas.HistorySessionItem.model_validate(session).model_dump()
        base["completed_count"] = completed_count or 0
        base["skipped_count"] = skipped_count or 0
        items.append(base)
    return success_response(paginated_list(items, total, page, page_size))


@router.get("/sessions/{session_id}/history-detail")
def session_history_detail(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    session = training_service.get_session_with_units_items(
        db, session_id, current_user.user_id
    )
    return success_response(_session_response(session))


@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    session = training_service.get_session_with_units_items(
        db, session_id, current_user.user_id
    )
    return success_response(_session_response(session))


@router.post("/sessions/{session_id}/items/add-temp-set")
def add_temp_set(
    session_id: str,
    payload: schemas.AddTempSetRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    new_item = training_service.add_temporary_set(
        db,
        session_id,
        current_user.user_id,
        payload.session_unit_id,
        payload.based_on_item_id,
        payload.target_weight,
        payload.target_reps,
        payload.target_rest_seconds,
    )
    return success_response(_serialize_session_item(new_item))


@router.post("/sessions/{session_id}/items/{item_id}/complete")
def complete_item(
    session_id: str,
    item_id: str,
    payload: schemas.CompleteItemRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    next_item, rest_record = training_service.complete_session_item(
        db,
        session_id,
        item_id,
        current_user.user_id,
        payload.actual_weight,
        payload.actual_reps,
        payload.completed_at,
    )
    return success_response(
        schemas.NextStateResponse(
            next_item=next_item,
            rest_record=rest_record,
        ).model_dump()
    )


@router.post("/sessions/{session_id}/items/{item_id}/skip")
def skip_item(
    session_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    next_item, rest_record = training_service.skip_session_item(
        db, session_id, item_id, current_user.user_id
    )
    return success_response(
        schemas.NextStateResponse(
            next_item=next_item,
            rest_record=rest_record,
        ).model_dump()
    )


@router.post("/sessions/{session_id}/rest/{rest_id}/skip")
def skip_rest(
    session_id: str,
    rest_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    rest, current_item = training_service.skip_rest(
        db, session_id, rest_id, current_user.user_id
    )
    return success_response(
        {
            "rest_record": _serialize_rest_record(rest),
            "next_item": _serialize_session_item(current_item),
        }
    )


@router.post("/sessions/{session_id}/rest/{rest_id}/complete")
def complete_rest(
    session_id: str,
    rest_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    rest = training_service.complete_rest(
        db, session_id, rest_id, current_user.user_id
    )
    return success_response(_serialize_rest_record(rest))


@router.post("/sessions/{session_id}/rest/{rest_id}/extend")
def extend_rest(
    session_id: str,
    rest_id: str,
    payload: schemas.ExtendRestRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    rest = training_service.extend_rest(
        db, session_id, rest_id, current_user.user_id, payload.additional_seconds
    )
    return success_response(_serialize_rest_record(rest))


@router.post("/sessions/{session_id}/finish")
def finish_session(
    session_id: str,
    payload: schemas.FinishSessionRequest,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    finish_type = SessionStatus(payload.finish_type)
    session = training_service.finish_session(
        db, session_id, current_user.user_id, finish_type, payload.end_time
    )
    return success_response(_session_response(session))
