from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.response import success_response
from app.core.exceptions import AppException
from app.models.user import UserAccount, GoalStage
from app.schemas.user import (
    ProfileResponse,
    ProfileUpdateRequest,
    GoalResponse,
    GoalUpdateRequest,
)
from app.schemas.weight import WeightRecordCreate
from app.services import user as user_service
from app.services import weight as weight_service
from app.utils.time import now

router = APIRouter()


@router.get("/profile")
def get_profile(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = user_service.get_profile(db, current_user.user_id)
    return success_response(
        ProfileResponse(
            nickname=profile.nickname,
            avatar_url=profile.avatar_url,
            gender=profile.gender.value if profile.gender else None,
            birth_year=profile.birth_year,
            height_cm=profile.height_cm,
            current_weight_kg=profile.current_weight_kg,
        ).model_dump()
    )


@router.put("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "height_cm" in data:
        if not (100 <= data["height_cm"] <= 250):
            raise AppException(40003, "身高需在100-250cm之间")
    if "current_weight_kg" in data:
        if not (20 <= data["current_weight_kg"] <= 300):
            raise AppException(40003, "体重需在20-300kg之间")
    if "birth_year" in data:
        if data["birth_year"] > datetime.now().year:
            raise AppException(40003, "出生年份不能大于当前年份")

    profile = user_service.update_profile(db, current_user.user_id, data)
    return success_response(
        ProfileResponse(
            nickname=profile.nickname,
            avatar_url=profile.avatar_url,
            gender=profile.gender.value if profile.gender else None,
            birth_year=profile.birth_year,
            height_cm=profile.height_cm,
            current_weight_kg=profile.current_weight_kg,
        ).model_dump()
    )


@router.get("/goal")
def get_goal(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = user_service.get_active_goal(db, current_user.user_id)
    if not goal:
        return success_response(None)
    return success_response(
        GoalResponse(
            goal_stage=goal.goal_stage.value,
            calorie_target=goal.calorie_target,
            protein_target=goal.protein_target,
            target_weight_kg=goal.target_weight_kg,
        ).model_dump()
    )


@router.put("/goal")
def update_goal(
    payload: GoalUpdateRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "goal_stage" in data:
        if data["goal_stage"] not in {GoalStage.fat_loss.value, GoalStage.muscle_gain.value}:
            raise AppException(40003, "目标阶段参数错误")
    if "calorie_target" in data:
        if not (800 <= data["calorie_target"] <= 6000):
            raise AppException(40003, "热量目标需在800-6000之间")
    if "protein_target" in data:
        if not (20 <= data["protein_target"] <= 400):
            raise AppException(40003, "蛋白质目标需在20-400之间")
    if "target_weight_kg" in data and data["target_weight_kg"] is not None:
        if not (20 <= data["target_weight_kg"] <= 300):
            raise AppException(40003, "目标体重需在20-300kg之间")

    sync_weight = data.pop("sync_weight_record", False)
    current_weight = data.pop("current_weight_kg", None)

    goal = user_service.set_active_goal(db, current_user.user_id, data)

    if sync_weight and current_weight is not None:
        if not (20 <= current_weight <= 300):
            raise AppException(40003, "体重需在20-300kg之间")
        profile = user_service.get_profile(db, current_user.user_id)
        profile.current_weight_kg = current_weight
        weight_service.create_weight_record(
            db,
            current_user.user_id,
            WeightRecordCreate(
                weight_kg=current_weight,
                record_time=now(),
                note="目标设置同步",
            ),
        )
        db.commit()

    return success_response(
        GoalResponse(
            goal_stage=goal.goal_stage.value,
            calorie_target=goal.calorie_target,
            protein_target=goal.protein_target,
            target_weight_kg=goal.target_weight_kg,
        ).model_dump()
    )
