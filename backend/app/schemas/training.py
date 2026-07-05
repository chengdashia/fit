from datetime import datetime
from typing import Optional, Literal, Union, List, Annotated
from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.models.training import UnitType, GoalType, SessionItemStatus, RestEndType


# ---------- Unit config (discriminated union) ----------

class NormalSet(BaseModel):
    set_index: int
    target_weight: float
    target_reps: int
    target_rest_seconds: int


class NormalConfig(BaseModel):
    unit_type: Literal["normal"]
    exercise_name: str
    sets: List[NormalSet]


class SupersetExercise(BaseModel):
    exercise_name: str
    target_weight: float
    target_reps: int


class SupersetConfig(BaseModel):
    unit_type: Literal["superset"]
    unit_name: str
    rounds: int
    exercises: List[SupersetExercise]
    target_rest_seconds: int


class DropsetSegment(BaseModel):
    segment_index: int
    target_weight: float
    target_reps: int


class DropsetConfig(BaseModel):
    unit_type: Literal["dropset"]
    exercise_name: str
    rounds: int
    segments: List[DropsetSegment]
    target_rest_seconds: int


UnitConfig = Union[NormalConfig, SupersetConfig, DropsetConfig]


# ---------- Template request schemas ----------

class TemplateUnitCreate(BaseModel):
    unit_type: UnitType
    unit_name: str
    sort_order: Optional[int] = 0
    config: Annotated[UnitConfig, Field(discriminator="unit_type")]

    @model_validator(mode="after")
    def check_config_kind(self):
        if self.unit_type.value != self.config.unit_type:
            raise ValueError("config unit_type must match unit_type")
        return self


class TemplateCreate(BaseModel):
    template_name: str
    description: Optional[str] = None
    goal_type: Optional[GoalType] = GoalType.other
    units: List[TemplateUnitCreate]


class TemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    description: Optional[str] = None
    goal_type: Optional[GoalType] = None
    units: List[TemplateUnitCreate]


# ---------- Response schemas ----------

class TemplateUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    unit_type: str
    unit_name: str
    sort_order: int
    config_json: dict
    created_at: datetime


class TemplateListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    template_name: str
    description: Optional[str]
    goal_type: str
    status: str
    last_used_at: Optional[datetime]
    created_at: datetime
    unit_count: int = 0


class TemplateDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    template_name: str
    description: Optional[str]
    goal_type: str
    status: str
    last_used_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    units: List[TemplateUnitResponse]


class SessionUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    unit_type: str
    unit_name: str
    sort_order: int
    status: str


class SessionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_unit_id: str
    exercise_name: str
    round_index: int
    set_index: int
    segment_index: int
    target_weight: float
    target_reps: int
    target_rest_seconds: int
    actual_weight: Optional[float]
    actual_reps: Optional[int]
    actual_rest_seconds: Optional[int]
    status: str
    is_temporary_added: bool
    completed_at: Optional[datetime]


class RestRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    related_item_id: str
    planned_rest_seconds: int
    rest_start_time: datetime
    rest_target_end_time: datetime
    rest_actual_end_time: Optional[datetime]
    actual_rest_seconds: Optional[int]
    end_type: Optional[str]


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    template_id: Optional[str]
    template_name_snapshot: str
    session_status: str
    start_time: datetime
    end_time: Optional[datetime]
    duration_seconds: int
    current_unit_id: Optional[str]
    current_item_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    units: List[SessionUnitResponse]
    items: List[SessionItemResponse]
    rest_records: List[RestRecordResponse]
    current_item: Optional[SessionItemResponse] = None
    active_rest_record: Optional[RestRecordResponse] = None


class NextStateResponse(BaseModel):
    next_item: Optional[SessionItemResponse] = None
    rest_record: Optional[RestRecordResponse] = None


class HistorySessionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    template_name_snapshot: str
    session_status: str
    start_time: datetime
    end_time: Optional[datetime]
    duration_seconds: int
    completed_count: int = 0
    skipped_count: int = 0


class HistoryListResponse(BaseModel):
    list: List[HistorySessionItem]
    page: int
    page_size: int
    total: int
    has_more: bool


# ---------- Action request schemas ----------

class StartSessionRequest(BaseModel):
    template_id: str
    start_time: datetime


class CompleteItemRequest(BaseModel):
    actual_weight: float
    actual_reps: int
    completed_at: datetime


class AddTempSetRequest(BaseModel):
    session_unit_id: str
    based_on_item_id: str
    target_weight: float
    target_reps: int
    target_rest_seconds: int


class FinishSessionRequest(BaseModel):
    finish_type: Literal["completed", "interrupted_saved", "abandoned"]
    end_time: datetime


class ExtendRestRequest(BaseModel):
    additional_seconds: int
