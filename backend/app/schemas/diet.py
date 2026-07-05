from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional


class RecognizeCandidate(BaseModel):
    food_name: str
    portion_desc: str
    weight_g: float
    calorie: float
    protein: float
    carb: float
    fat: float
    confidence: float


class RecognizeResponse(BaseModel):
    recognize_id: str
    status: str
    candidates: List[RecognizeCandidate]


class FoodSearchItem(BaseModel):
    id: str
    food_name: str
    category: Optional[str]
    calorie_per_100g: float
    protein_per_100g: float
    carb_per_100g: float
    fat_per_100g: float
    source: str


class ConfirmFoodItem(BaseModel):
    food_name: str
    portion_desc: Optional[str]
    weight_g: float
    calorie: float
    protein: float
    carb: float
    fat: float
    data_source: str


class ConfirmRequest(BaseModel):
    meal_type: str
    record_time: datetime
    source_type: str
    save_as_frequent: bool = False
    food_items: List[ConfirmFoodItem]


class DailyTotals(BaseModel):
    total_calorie: float
    total_protein: float
    total_carb: float
    total_fat: float


class ConfirmResponse(BaseModel):
    record_id: str
    daily_totals: DailyTotals


class RecordFoodItem(BaseModel):
    id: str
    food_name: str
    food_category: Optional[str]
    portion_desc: Optional[str]
    weight_g: float
    calorie: float
    protein: float
    carb: float
    fat: float
    data_source: str
    is_user_modified: bool


class RecordItem(BaseModel):
    id: str
    meal_type: str
    record_time: datetime
    source_type: str
    total_calorie: float
    total_protein: float
    total_carb: float
    total_fat: float
    status: str
    food_items: List[RecordFoodItem]


class RecordsByDateResponse(BaseModel):
    date: str
    grouped_records: dict
    daily_totals: DailyTotals


class UpdateRequest(BaseModel):
    meal_type: Optional[str] = None
    record_time: Optional[datetime] = None
    food_items: Optional[List[ConfirmFoodItem]] = None


class FrequentFoodCreate(BaseModel):
    food_name: str
    default_portion_desc: Optional[str] = None
    default_weight_g: float
    calorie: float
    protein: float = 0
    carb: float = 0
    fat: float = 0
    source_type: str = "custom"
