from sqlalchemy import String, DateTime, Date, Integer, Float, Enum, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import BaseMixin
import enum


class MealType(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class SourceType(str, enum.Enum):
    photo_ai = "photo_ai"
    manual_search = "manual_search"
    frequent_food = "frequent_food"
    custom = "custom"


class MealRecordStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    revoked = "revoked"
    deleted = "deleted"


class DataSource(str, enum.Enum):
    ai = "ai"
    standard_db = "standard_db"
    user_custom = "user_custom"
    frequent = "frequent"


class FrequentSourceType(str, enum.Enum):
    ai_saved = "ai_saved"
    custom = "custom"
    manual = "manual"


class FrequentStatus(str, enum.Enum):
    active = "active"
    deleted = "deleted"


class FoodDbStatus(str, enum.Enum):
    active = "active"
    disabled = "disabled"


class MealRecord(BaseMixin, Base):
    __tablename__ = "meal_record"

    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    record_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    record_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    meal_type: Mapped[str] = mapped_column(Enum(MealType), nullable=False)
    source_type: Mapped[str] = mapped_column(Enum(SourceType), nullable=False)
    total_calorie: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    total_protein: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    total_carb: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    total_fat: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    status: Mapped[str] = mapped_column(Enum(MealRecordStatus), default=MealRecordStatus.confirmed, nullable=False)
    is_saved_as_frequent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    food_items: Mapped[list["MealFoodItem"]] = relationship(
        "MealFoodItem", back_populates="meal_record", lazy="selectin"
    )


class MealFoodItem(BaseMixin, Base):
    __tablename__ = "meal_food_item"

    meal_record_id: Mapped[str] = mapped_column(String(32), ForeignKey("meal_record.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    food_name: Mapped[str] = mapped_column(String(128), nullable=False)
    food_category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    portion_desc: Mapped[str | None] = mapped_column(String(64), nullable=True)
    weight_g: Mapped[float] = mapped_column(Float, nullable=False)
    calorie: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    protein: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    carb: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    fat: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    data_source: Mapped[str] = mapped_column(Enum(DataSource), nullable=False)
    is_user_modified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    meal_record: Mapped["MealRecord"] = relationship("MealRecord", back_populates="food_items")


class FrequentFood(BaseMixin, Base):
    __tablename__ = "frequent_food"

    user_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    food_name: Mapped[str] = mapped_column(String(128), nullable=False)
    default_portion_desc: Mapped[str | None] = mapped_column(String(64), nullable=True)
    default_weight_g: Mapped[float] = mapped_column(Float, nullable=False)
    calorie: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    protein: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    carb: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    fat: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    source_type: Mapped[str] = mapped_column(Enum(FrequentSourceType), nullable=False)
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_used_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(Enum(FrequentStatus), default=FrequentStatus.active, nullable=False)


class FoodDatabase(BaseMixin, Base):
    __tablename__ = "food_database"

    food_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    alias_names: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    calorie_per_100g: Mapped[float] = mapped_column(Float, nullable=False)
    protein_per_100g: Mapped[float] = mapped_column(Float, nullable=False)
    carb_per_100g: Mapped[float] = mapped_column(Float, nullable=False)
    fat_per_100g: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(Enum(FoodDbStatus), default=FoodDbStatus.active, nullable=False)
