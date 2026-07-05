import os
import shutil
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.response import success_response
from app.models.user import UserAccount
from app.schemas import diet as diet_schema
from app.services import diet as diet_service

from app.adapters.food_recognition import FoodRecognitionAdapter

router = APIRouter()
_food_adapter = FoodRecognitionAdapter()


@router.post("/recognize")
async def recognize(
    image_file: UploadFile = File(...),
    meal_type: str = Form(...),
    record_time: str = Form(...),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        record_dt = datetime.fromisoformat(record_time)
    except ValueError:
        raise AppException(40003, "记录时间格式错误")

    tmp_filename = f"{uuid.uuid4().hex}_{image_file.filename or 'upload'}"
    tmp_path = os.path.join("/tmp", tmp_filename)

    try:
        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(image_file.file, buffer)
    finally:
        image_file.file.close()

    try:
        result = _food_adapter.recognize(tmp_path, meal_type, record_time)
        if result.get("status") != "success":
            raise AppException(41001, "饮食识别失败")
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    return success_response(result)


@router.get("/foods/search")
def search_foods(
    keyword: str = Query(..., min_length=1),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = diet_service.search_foods(db, current_user.user_id, keyword)
    return success_response(results)


@router.post("/records/confirm")
def confirm_record(
    payload: diet_schema.ConfirmRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record, daily_totals = diet_service.confirm_meal(db, current_user.user_id, payload)
    return success_response({
        "record_id": record.id,
        "daily_totals": daily_totals,
    })


@router.get("/records")
def get_records(
    date: str = Query(..., description="YYYY-MM-DD"),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        record_date = datetime.fromisoformat(date).date()
    except ValueError:
        raise AppException(40003, "日期格式错误")

    data = diet_service.get_records_by_date(db, current_user.user_id, record_date)
    return success_response(data)


@router.put("/records/{record_id}")
def update_record(
    record_id: str,
    payload: diet_schema.UpdateRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = diet_service.update_meal(db, current_user.user_id, record_id, payload)
    return success_response({"record_id": record.id})


@router.delete("/records/{record_id}")
def delete_record(
    record_id: str,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    diet_service.delete_meal(db, current_user.user_id, record_id)
    return success_response()


@router.post("/records/{record_id}/revoke")
def revoke_record(
    record_id: str,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    diet_service.revoke_meal(db, current_user.user_id, record_id)
    return success_response()


@router.get("/frequent-foods")
def get_frequent_foods(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    foods = diet_service.list_frequent_foods(db, current_user.user_id)
    data = []
    for food in foods:
        data.append({
            "id": food.id,
            "food_name": food.food_name,
            "default_portion_desc": food.default_portion_desc,
            "default_weight_g": food.default_weight_g,
            "calorie": food.calorie,
            "protein": food.protein,
            "carb": food.carb,
            "fat": food.fat,
            "source_type": food.source_type.value,
            "use_count": food.use_count,
            "last_used_at": food.last_used_at.isoformat() if food.last_used_at else None,
            "status": food.status.value,
        })
    return success_response(data)


@router.post("/frequent-foods")
def create_frequent_food(
    payload: diet_schema.FrequentFoodCreate,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    food = diet_service.create_frequent_food(db, current_user.user_id, payload)
    return success_response({"id": food.id})


@router.delete("/frequent-foods/{food_id}")
def delete_frequent_food(
    food_id: str,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    diet_service.delete_frequent_food(db, current_user.user_id, food_id)
    return success_response()
