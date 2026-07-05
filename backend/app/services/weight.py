from datetime import datetime, date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.weight import WeightRecord, WeightRecordStatus
from app.schemas.weight import WeightRecordCreate, WeightRecordUpdate
from app.utils.time import now


def create_weight_record(
    db: Session,
    user_id: str,
    payload: WeightRecordCreate,
) -> WeightRecord:
    record = WeightRecord(
        user_id=user_id,
        weight_kg=payload.weight_kg,
        record_time=payload.record_time,
        record_date=payload.record_time.date(),
        note=payload.note,
        status=WeightRecordStatus.normal,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_weight_records(
    db: Session,
    user_id: str,
    page: int,
    page_size: int,
    record_date: Optional[date] = None,
):
    query = db.query(WeightRecord).filter(
        WeightRecord.user_id == user_id,
        WeightRecord.status == WeightRecordStatus.normal,
    )
    if record_date is not None:
        query = query.filter(WeightRecord.record_date == record_date)

    total = query.count()
    records = (
        query.order_by(desc(WeightRecord.record_time))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return records, total


def get_weight_record(db: Session, record_id: str, user_id: str) -> Optional[WeightRecord]:
    return (
        db.query(WeightRecord)
        .filter(
            WeightRecord.id == record_id,
            WeightRecord.user_id == user_id,
            WeightRecord.status == WeightRecordStatus.normal,
        )
        .first()
    )


def update_weight_record(
    db: Session,
    record: WeightRecord,
    payload: WeightRecordUpdate,
) -> WeightRecord:
    if payload.weight_kg is not None:
        record.weight_kg = payload.weight_kg
    if payload.record_time is not None:
        record.record_time = payload.record_time
        record.record_date = payload.record_time.date()
    if payload.note is not None:
        record.note = payload.note

    db.commit()
    db.refresh(record)
    return record


def delete_weight_record(db: Session, record: WeightRecord) -> WeightRecord:
    record.status = WeightRecordStatus.deleted
    db.commit()
    db.refresh(record)
    return record


def get_weight_trend(
    db: Session,
    user_id: str,
    range_value: str,
) -> list[dict]:
    days = 7 if range_value == "7d" else 30
    start_time = now() - timedelta(days=days)

    records = (
        db.query(WeightRecord)
        .filter(
            WeightRecord.user_id == user_id,
            WeightRecord.status == WeightRecordStatus.normal,
            WeightRecord.record_time >= start_time,
        )
        .order_by(desc(WeightRecord.record_time))
        .all()
    )

    latest_by_date: dict[date, WeightRecord] = {}
    for record in records:
        if record.record_date not in latest_by_date:
            latest_by_date[record.record_date] = record

    points = []
    for d in sorted(latest_by_date.keys()):
        record = latest_by_date[d]
        points.append(
            {
                "date": d,
                "weight_kg": record.weight_kg,
                "record_time": record.record_time,
            }
        )
    return points
