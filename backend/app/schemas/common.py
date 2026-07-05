from pydantic import BaseModel
from typing import Optional, Any


class CommonResponse(BaseModel):
    code: int
    message: str
    data: Optional[Any] = None


class PaginationResponse(BaseModel):
    list: list
    page: int
    page_size: int
    total: int
    has_more: bool
