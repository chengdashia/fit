from sqlalchemy import String, DateTime, Integer, Float, Enum, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import BaseMixin
import enum


class TemplateStatus(str, enum.Enum):
    active = "active"
    deleted = "deleted"


class UnitType(str, enum.Enum):
    normal = "normal"
    superset = "superset"
    dropset = "dropset"


class SessionStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    resting = "resting"
    completed = "completed"
    interrupted_saved = "interrupted_saved"
    abandoned = "abandoned"


class SessionItemStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"
    unfinished = "unfinished"


class RestEndType(str, enum.Enum):
    natural_end = "natural_end"
    skipped = "skipped"
    extended = "extended"


class GoalType(str, enum.Enum):
    fat_loss = "fat_loss"
    muscle_gain = "muscle_gain"
    strength = "strength"
    other = "other"


class TrainingTemplate(BaseMixin, Base):
    __tablename__ = "training_template"

    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    template_name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal_type: Mapped[str] = mapped_column(Enum(GoalType), default=GoalType.other, nullable=False)
    status: Mapped[str] = mapped_column(Enum(TemplateStatus), default=TemplateStatus.active, nullable=False)
    last_used_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    units: Mapped[list["TrainingTemplateUnit"]] = relationship(
        "TrainingTemplateUnit", back_populates="template", lazy="selectin"
    )


class TrainingTemplateUnit(BaseMixin, Base):
    __tablename__ = "training_template_unit"

    template_id: Mapped[str] = mapped_column(String(32), ForeignKey("training_template.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    unit_type: Mapped[str] = mapped_column(Enum(UnitType), nullable=False)
    unit_name: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    template: Mapped["TrainingTemplate"] = relationship("TrainingTemplate", back_populates="units")


class TrainingSession(BaseMixin, Base):
    __tablename__ = "training_session"

    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    template_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("training_template.id"), nullable=True)
    template_name_snapshot: Mapped[str] = mapped_column(String(128), nullable=False)
    session_status: Mapped[str] = mapped_column(Enum(SessionStatus), default=SessionStatus.draft, nullable=False)
    start_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_unit_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    current_item_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_snapshot: Mapped[bool] = mapped_column(default=True, nullable=False)

    units: Mapped[list["TrainingSessionUnit"]] = relationship(
        "TrainingSessionUnit", back_populates="session", lazy="selectin"
    )
    items: Mapped[list["TrainingSessionItem"]] = relationship(
        "TrainingSessionItem", back_populates="session", lazy="selectin"
    )
    rest_records: Mapped[list["TrainingRestRecord"]] = relationship(
        "TrainingRestRecord", back_populates="session", lazy="selectin"
    )


class TrainingSessionUnit(BaseMixin, Base):
    __tablename__ = "training_session_unit"

    session_id: Mapped[str] = mapped_column(String(32), ForeignKey("training_session.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    unit_type: Mapped[str] = mapped_column(Enum(UnitType), nullable=False)
    unit_name: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(Enum(SessionItemStatus), default=SessionItemStatus.not_started, nullable=False)

    session: Mapped["TrainingSession"] = relationship("TrainingSession", back_populates="units")


class TrainingSessionItem(BaseMixin, Base):
    __tablename__ = "training_session_item"

    session_id: Mapped[str] = mapped_column(String(32), ForeignKey("training_session.id"), nullable=False, index=True)
    session_unit_id: Mapped[str] = mapped_column(String(32), ForeignKey("training_session_unit.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    exercise_name: Mapped[str] = mapped_column(String(128), nullable=False)
    round_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    set_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    segment_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_weight: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    target_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    actual_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_reps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_rest_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    actual_rest_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(Enum(SessionItemStatus), default=SessionItemStatus.not_started, nullable=False)
    is_temporary_added: Mapped[bool] = mapped_column(default=False, nullable=False)
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["TrainingSession"] = relationship("TrainingSession", back_populates="items")


class TrainingRestRecord(BaseMixin, Base):
    __tablename__ = "training_rest_record"

    session_id: Mapped[str] = mapped_column(String(32), ForeignKey("training_session.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    related_item_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    planned_rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    rest_start_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    rest_target_end_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    rest_actual_end_time: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_rest_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_type: Mapped[str | None] = mapped_column(Enum(RestEndType), nullable=True)

    session: Mapped["TrainingSession"] = relationship("TrainingSession", back_populates="rest_records")
