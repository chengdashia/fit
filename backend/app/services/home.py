from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import GoalStatus, UserGoal, UserProfile
from app.models.diet import MealRecord, MealRecordStatus
from app.models.training import SessionStatus, TrainingSession, TrainingTemplate, TemplateStatus
from app.models.weight import WeightRecord, WeightRecordStatus


LOCAL_TZ = ZoneInfo("Asia/Shanghai")


def _local_start_date(session: TrainingSession) -> date:
    return session.start_time.astimezone(LOCAL_TZ).date()


def _get_goal(db: Session, user_id: str) -> dict | None:
    goal = (
        db.query(UserGoal)
        .filter(UserGoal.user_id == user_id, UserGoal.goal_status == GoalStatus.active)
        .first()
    )
    if not goal:
        return None
    return {
        "goal_stage": goal.goal_stage.value,
        "calorie_target": goal.calorie_target,
        "protein_target": goal.protein_target,
        "target_weight_kg": goal.target_weight_kg,
    }


def _get_diet_summary(db: Session, user_id: str, query_date: date) -> dict:
    row = (
        db.query(
            func.coalesce(func.sum(MealRecord.total_calorie), 0).label("calorie_intake"),
            func.coalesce(func.sum(MealRecord.total_protein), 0).label("protein_intake"),
            func.coalesce(func.sum(MealRecord.total_carb), 0).label("carb_intake"),
            func.coalesce(func.sum(MealRecord.total_fat), 0).label("fat_intake"),
        )
        .filter(
            MealRecord.user_id == user_id,
            MealRecord.record_date == query_date,
            MealRecord.status == MealRecordStatus.confirmed,
        )
        .first()
    )
    return {
        "calorie_intake": float(row.calorie_intake),
        "protein_intake": float(row.protein_intake),
        "carb_intake": float(row.carb_intake),
        "fat_intake": float(row.fat_intake),
    }


def _get_training_summary(db: Session, user_id: str, query_date: date) -> dict:
    sessions = (
        db.query(TrainingSession)
        .filter(TrainingSession.user_id == user_id)
        .all()
    )

    today_sessions = [s for s in sessions if _local_start_date(s) == query_date]

    unfinished_session_id = None
    for s in sessions:
        if s.session_status in (
            SessionStatus.draft,
            SessionStatus.in_progress,
            SessionStatus.resting,
        ):
            unfinished_session_id = s.id
            break

    # PRD: global in_progress/resting takes priority over today's completed status
    if unfinished_session_id:
        today_status_value = SessionStatus.in_progress.value
    else:
        priority = {
            SessionStatus.completed.value: 3,
            SessionStatus.interrupted_saved.value: 2,
        }
        today_status_value = "not_started"
        max_priority = 0
        for session in today_sessions:
            p = priority.get(session.session_status, 0)
            if p > max_priority:
                max_priority = p
                today_status_value = session.session_status.value

    start_of_week = query_date - timedelta(days=query_date.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    weekly_count = sum(
        1
        for s in sessions
        if start_of_week <= _local_start_date(s) <= end_of_week
        and s.session_status in (SessionStatus.completed, SessionStatus.interrupted_saved)
    )

    from sqlalchemy import case
    latest_template = (
        db.query(TrainingTemplate)
        .filter(
            TrainingTemplate.user_id == user_id,
            TrainingTemplate.status == TemplateStatus.active,
        )
        .order_by(
            case(
                (TrainingTemplate.last_used_at.is_(None), 1),
                else_=0
            ),
            TrainingTemplate.last_used_at.desc()
        )
        .first()
    )
    last_template_name = latest_template.template_name if latest_template else None

    return {
        "today_status": today_status_value,
        "weekly_training_count": weekly_count,
        "unfinished_session_id": unfinished_session_id,
        "last_template_name": last_template_name,
        "last_template_id": latest_template.id if latest_template else None,
    }


def _get_weight_summary(
    db: Session, user_id: str, query_date: date, target_weight_kg: float | None
) -> dict:
    record_time = None
    record = (
        db.query(WeightRecord)
        .filter(
            WeightRecord.user_id == user_id,
            WeightRecord.status == WeightRecordStatus.normal,
            WeightRecord.record_date == query_date,
        )
        .order_by(WeightRecord.record_time.desc())
        .first()
    )

    if record:
        latest_weight_kg = record.weight_kg
        record_time = record.record_time
    else:
        record = (
            db.query(WeightRecord)
            .filter(
                WeightRecord.user_id == user_id,
                WeightRecord.status == WeightRecordStatus.normal,
                WeightRecord.record_date < query_date,
            )
            .order_by(WeightRecord.record_date.desc(), WeightRecord.record_time.desc())
            .first()
        )
        if record:
            latest_weight_kg = record.weight_kg
            record_time = record.record_time
        else:
            profile = (
                db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            )
            latest_weight_kg = profile.current_weight_kg if profile else None

    target_diff_kg = None
    if latest_weight_kg is not None and target_weight_kg is not None:
        target_diff_kg = round(latest_weight_kg - target_weight_kg, 2)

    return {
        "latest_weight_kg": latest_weight_kg,
        "latest_record_time": record_time.isoformat() if record_time else None,
        "target_diff_kg": target_diff_kg,
    }


def get_dashboard_data(db: Session, user_id: str, query_date: date) -> dict:
    goal = _get_goal(db, user_id)
    target_weight_kg = goal["target_weight_kg"] if goal else None

    return {
        "date": query_date.isoformat(),
        "goal": goal,
        "diet_summary": _get_diet_summary(db, user_id, query_date),
        "training_summary": _get_training_summary(db, user_id, query_date),
        "weight_summary": _get_weight_summary(db, user_id, query_date, target_weight_kg),
    }
