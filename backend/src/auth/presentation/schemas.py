from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import CamelModel


class SignupRequest(CamelModel):
    # 형식은 여기서 거르고, 세부 규칙(72바이트·중복)은 도메인·서비스가 판단
    email: str = Field(max_length=320, examples=["hero@pixelmart.test"])
    password: str = Field(min_length=8, examples=["pixel-pass-1"])
    nickname: str = Field(min_length=1, max_length=30, examples=["용사"])


class TokenResponse(BaseModel):
    """OAuth2 표준 응답이라 snake_case 그대로 (Swagger Authorize가 access_token을 읽는다)"""

    access_token: str
    token_type: str = "bearer"


class AdminUserOut(CamelModel):
    """관리자 회원 목록 한 줄 — 주소·전화 없음"""

    id: int
    email: str
    nickname: str
    role: str
    signup_method: Literal["email", "google"]
    created_at: datetime
