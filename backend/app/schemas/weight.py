from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, field_validator
from app.utils.time import now


class WeightRecordCreate(BaseModel):
    weight_kg: float
    record_time: datetime
    note: Optional[str] = None

    @field_validator("weight_kg")
    @classmethod
    def validate_weight_kg(cls, v: float) -> float:
        if v < 20 or v > 300:
            raise ValueError("体重必须在20-300kg之间")
        if abs(round(v * 10) - v * 10) > 1e-9:
            raise ValueError("体重最多保留1位小数")
        return v

    @field_validator("record_time")
    @classmethod
    def validate_record_time(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            v = v.replace(tzinfo=datetime.now().astimezone().tzinfo)
        if v > now():
            raise ValueError("记录时间不能为未来时间")
        return v


class WeightRecordUpdate(BaseModel):
    weight_kg: Optional[float] = None
    record_time: Optional[datetime] = None
    note: Optional[str] = None

    @field_validator("weight_kg")
    @classmethod
    def validate_weight_kg(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        if v < 20 or v > 300:
            raise ValueError("体重必须在20-300kg之间")
        if abs(round(v * 10) - v * 10) > 1e-9:
            raise ValueError("体重最多保留1位小数")
        return v

    @field_validator("record_time")
    @classmethod
    def validate_record_time(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return v
        if v.tzinfo is None:
            v = v.replace(tzinfo=datetime.now().astimezone().tzinfo)
        if v > now():
            raise ValueError("记录时间不能为未来时间")
        return v


class WeightRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    weight_kg: float
    record_time: datetime
    record_date: date
    note: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

class WeightTrendPoint(BaseModel):
    date: date
    weight_kg: float
    record_time: datetime


class WeightTrendOut(BaseModel):
    range: Literal["7d", "30d"]
    points: list[WeightTrendPoint]


class WeightRecordListOut(BaseModel):
    list: list[WeightRecordOut]
    page: int
    page_size: int
    total: int
    has_more: bool
