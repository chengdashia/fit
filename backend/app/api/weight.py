from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.response import success_response, paginated_list
from app.core.exceptions import AppException
from app.api.deps import get_current_user
from app.models.user import UserAccount
from app.schemas.weight import (
    WeightRecordCreate,
    WeightRecordUpdate,
    WeightRecordOut,
    WeightTrendOut,
)
from app.services import weight as weight_service
from app.utils.time import parse_date


router = APIRouter()


@router.post("/records")
def create_record(
    payload: WeightRecordCreate,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    record = weight_service.create_weight_record(db, current_user.user_id, payload)
    return success_response(WeightRecordOut.model_validate(record).model_dump())


@router.get("/records")
def list_records(
    date: str | None = Query(None, description="记录日期，格式 YYYY-MM-DD"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    record_date = None
    if date:
        try:
            record_date = parse_date(date)
        except ValueError:
            raise AppException(40003, "日期格式错误")

    records, total = weight_service.list_weight_records(
        db, current_user.user_id, page, page_size, record_date
    )
    items = [WeightRecordOut.model_validate(r).model_dump() for r in records]
    return success_response(paginated_list(items, total, page, page_size))


@router.put("/records/{record_id}")
def update_record(
    record_id: str,
    payload: WeightRecordUpdate,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    record = weight_service.get_weight_record(db, record_id, current_user.user_id)
    if not record:
        raise AppException(40004, "记录不存在")

    updated = weight_service.update_weight_record(db, record, payload)
    return success_response(WeightRecordOut.model_validate(updated).model_dump())


@router.delete("/records/{record_id}")
def delete_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    record = weight_service.get_weight_record(db, record_id, current_user.user_id)
    if not record:
        raise AppException(40004, "记录不存在")

    weight_service.delete_weight_record(db, record)
    return success_response()


@router.get("/trend")
def get_trend(
    range: str = Query("7d", description="时间范围：7d 或 30d"),
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    if range not in ("7d", "30d"):
        raise AppException(40003, "range 参数错误，仅支持 7d 或 30d")

    points = weight_service.get_weight_trend(db, current_user.user_id, range)
    return success_response(WeightTrendOut(range=range, points=points).model_dump())
