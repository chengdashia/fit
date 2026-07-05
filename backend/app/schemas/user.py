from typing import Optional
from pydantic import BaseModel, Field


class ProfileResponse(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = None
    birth_year: Optional[int] = None
    height_cm: Optional[int] = None
    current_weight_kg: Optional[float] = None


class ProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = None
    birth_year: Optional[int] = None
    height_cm: Optional[int] = None
    current_weight_kg: Optional[float] = None


class GoalResponse(BaseModel):
    goal_stage: str
    calorie_target: int
    protein_target: int
    target_weight_kg: Optional[float] = None


class GoalUpdateRequest(BaseModel):
    goal_stage: Optional[str] = None
    calorie_target: Optional[int] = None
    protein_target: Optional[int] = None
    target_weight_kg: Optional[float] = None
    sync_weight_record: Optional[bool] = Field(default=False)
    current_weight_kg: Optional[float] = None
