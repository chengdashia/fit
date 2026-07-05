from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.core.response import error


class AppException(Exception):
    def __init__(self, code: int, message: str, data: dict = None):
        self.code = code
        self.message = message
        self.data = data or {}


async def app_exception_handler(request: Request, exc: AppException):
    return error(exc.code, exc.message, exc.data)


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(x) for x in first.get("loc", []))
    return error(40003, "参数错误", {"field": field, "reason": first.get("msg", "")})


async def general_exception_handler(request: Request, exc: Exception):
    return error(50000, "系统异常", {"detail": str(exc)})
