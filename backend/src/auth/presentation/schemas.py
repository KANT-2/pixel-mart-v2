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
    avatar_url: str | None = None
    suspended: bool = False
    withdrawn: bool = False
    order_count: int = 0
    report_count: int = 0


class AvatarResetRequest(CamelModel):
    """아바타 초기화 사유 (본인 알림에 함께 보여요)"""

    memo: str | None = Field(default=None, max_length=200)


class WithdrawRequest(CamelModel):
    """실수로 누르지 않게 '탈퇴'를 직접 입력받는다 (다르면 422)"""

    confirm: Literal["탈퇴"]


class SuspendRequest(CamelModel):
    """정지(true) · 해제(false). memo는 관리 기록용"""

    suspended: bool
    memo: str | None = Field(default=None, max_length=200)
