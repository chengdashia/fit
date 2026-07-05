from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import requests
from app.core.config import get_settings
from app.core.database import get_db
from app.core.response import success_response
from app.core.security import create_access_token
from app.core.exceptions import AppException
from app.schemas.auth import WechatLoginRequest
from app.services import user as user_service

router = APIRouter()
settings = get_settings()


def _fetch_wechat_openid(code: str) -> str:
    url = (
        "https://api.weixin.qq.com/sns/jscode2session"
        f"?appid={settings.WECHAT_APPID}"
        f"&secret={settings.WECHAT_SECRET}"
        f"&js_code={code}"
        f"&grant_type=authorization_code"
    )
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise AppException(40002, "微信登录请求失败", {"detail": str(exc)})

    data = resp.json()
    openid = data.get("openid")
    if not openid:
        raise AppException(40002, "微信登录失败", {"detail": data.get("errmsg", "unknown")})
    return openid


@router.post("/wechat-login")
def wechat_login(payload: WechatLoginRequest, db: Session = Depends(get_db)):
    if settings.WECHAT_MOCK_OPENID:
        openid = "mock_developer_openid"
    else:
        if not settings.WECHAT_APPID or not settings.WECHAT_SECRET:
            raise AppException(40002, "微信登录配置缺失")
        openid = _fetch_wechat_openid(payload.code)

    user = user_service.get_or_create_user_by_openid(db, openid)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token(user.user_id)
    return success_response({
        "token": token,
        "user_id": user.user_id,
        "has_goal": user_service.has_active_goal(db, user.user_id),
        "has_profile": user_service.has_profile(db, user.user_id),
    })
