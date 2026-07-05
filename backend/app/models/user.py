from sqlalchemy import String, DateTime, Integer, Float, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import BaseMixin
import enum


class UserStatus(str, enum.Enum):
    normal = "normal"
    disabled = "disabled"
    deleted = "deleted"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    unknown = "unknown"


class GoalStage(str, enum.Enum):
    fat_loss = "fat_loss"
    muscle_gain = "muscle_gain"


class GoalStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class UserAccount(BaseMixin, Base):
    __tablename__ = "user_account"

    user_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    openid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    unionid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(Enum(UserStatus), default=UserStatus.normal, nullable=False)
    last_login_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)


class UserProfile(BaseMixin, Base):
    __tablename__ = "user_profile"

    user_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    nickname: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    gender: Mapped[str | None] = mapped_column(Enum(Gender), default=Gender.unknown, nullable=True)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)


class UserGoal(BaseMixin, Base):
    __tablename__ = "user_goal"

    user_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    goal_stage: Mapped[str] = mapped_column(Enum(GoalStage), nullable=False)
    calorie_target: Mapped[int] = mapped_column(Integer, nullable=False)
    protein_target: Mapped[int] = mapped_column(Integer, nullable=False)
    target_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    goal_status: Mapped[str] = mapped_column(Enum(GoalStatus), default=GoalStatus.active, nullable=False)
