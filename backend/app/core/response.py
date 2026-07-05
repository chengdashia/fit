import json
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Any, Optional, Dict
from fastapi.responses import JSONResponse


class CustomJSONEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, datetime):
            return o.isoformat()
        if isinstance(o, date):
            return o.isoformat()
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, Enum):
            return o.value
        if hasattr(o, "isoformat"):
            return o.isoformat()
        return super().default(o)


def success(data: Any = None, message: str = "success") -> Dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


def error(code: int, message: str, data: Optional[Any] = None) -> JSONResponse:
    return JSONResponse(
        status_code=200,
        content={"code": code, "message": message, "data": data or {}},
        media_type="application/json",
    )


def success_response(data: Any = None, message: str = "success") -> JSONResponse:
    content = json.dumps(success(data, message), cls=CustomJSONEncoder, ensure_ascii=False)
    return JSONResponse(
        status_code=200,
        content=json.loads(content),
        media_type="application/json",
    )


def paginated_list(
    items: list,
    total: int,
    page: int,
    page_size: int
) -> Dict[str, Any]:
    return {
        "list": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_more": page * page_size < total,
    }