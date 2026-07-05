from pydantic import BaseModel, Field


class WechatLoginRequest(BaseModel):
    code: str = Field(..., min_length=1, description="微信登录临时 code")


class WechatLoginResponse(BaseModel):
    token: str
    user_id: str
    has_goal: bool
    has_profile: bool
