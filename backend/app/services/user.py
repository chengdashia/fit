import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.user import UserAccount, UserProfile, UserGoal, GoalStatus


def get_user_by_openid(db: Session, openid: str) -> UserAccount | None:
    return db.query(UserAccount).filter(UserAccount.openid == openid).first()


def create_user(db: Session, openid: str) -> UserAccount:
    user = UserAccount(
        user_id=uuid.uuid4().hex,
        openid=openid,
        status="normal",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_user_by_openid(db: Session, openid: str) -> UserAccount:
    user = get_user_by_openid(db, openid)
    if not user:
        user = create_user(db, openid)
    return user


def get_profile(db: Session, user_id: str) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def update_profile(db: Session, user_id: str, data: dict) -> UserProfile:
    profile = get_profile(db, user_id)
    for field in ["nickname", "avatar_url", "gender", "birth_year", "height_cm", "current_weight_kg"]:
        if field in data and data[field] is not None:
            setattr(profile, field, data[field])
    db.commit()
    db.refresh(profile)
    return profile


def has_profile(db: Session, user_id: str) -> bool:
    return db.query(UserProfile).filter(UserProfile.user_id == user_id).first() is not None


def get_active_goal(db: Session, user_id: str) -> UserGoal | None:
    return db.query(UserGoal).filter(
        UserGoal.user_id == user_id,
        UserGoal.goal_status == GoalStatus.active
    ).first()


def has_active_goal(db: Session, user_id: str) -> bool:
    return get_active_goal(db, user_id) is not None


def set_active_goal(db: Session, user_id: str, data: dict) -> UserGoal:
    goal = get_active_goal(db, user_id)
    is_new = goal is None
    if not goal:
        goal = UserGoal(user_id=user_id)
        db.add(goal)
    if "goal_stage" in data and data["goal_stage"] is not None:
        goal.goal_stage = data["goal_stage"]
    if "calorie_target" in data and data["calorie_target"] is not None:
        goal.calorie_target = data["calorie_target"]
    if "protein_target" in data and data["protein_target"] is not None:
        goal.protein_target = data["protein_target"]
    if "target_weight_kg" in data and data["target_weight_kg"] is not None:
        goal.target_weight_kg = data["target_weight_kg"]
    if is_new:
        missing = []
        if goal.goal_stage is None:
            missing.append("goal_stage")
        if goal.calorie_target is None:
            missing.append("calorie_target")
        if goal.protein_target is None:
            missing.append("protein_target")
        if missing:
            from app.core.exceptions import AppException
            raise AppException(40003, "参数错误", {"missing": missing})
    goal.goal_status = GoalStatus.active
    db.commit()
    db.refresh(goal)
    return goal
