from fastapi import Depends, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.exceptions import AppException
from app.models.user import UserAccount


def get_current_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db)
) -> UserAccount:
    if not authorization:
        raise AppException(40001, "登录已失效")
    
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppException(40001, "登录已失效")
    
    token = parts[1]
    user_id = decode_access_token(token)
    if not user_id:
        raise AppException(40001, "登录已失效")
    
    user = db.query(UserAccount).filter(
        UserAccount.user_id == user_id,
        UserAccount.status == "normal"
    ).first()
    if not user:
        raise AppException(40001, "登录已失效")
    
    return user
