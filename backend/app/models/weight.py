from sqlalchemy import String, DateTime, Date, Float, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import BaseMixin
import enum


class WeightRecordStatus(str, enum.Enum):
    normal = "normal"
    deleted = "deleted"


class WeightRecord(BaseMixin, Base):
    __tablename__ = "weight_record"

    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    record_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    record_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Enum(WeightRecordStatus), default=WeightRecordStatus.normal, nullable=False)
