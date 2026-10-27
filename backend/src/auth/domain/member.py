import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

ROLES = ("user", "admin")

SignupMethod = Literal["email", "google"]


@dataclass(frozen=True)
class MemberSummary:
    """관리자 회원 목록의 한 줄. 주소·전화 같은 개인정보는 담지 않는다."""

    id: int
    email: str
    nickname: str
    role: str
    google_linked: bool
    created_at: datetime
    avatar_url: str | None = None

    @property
    def signup_method(self) -> SignupMethod:
        return "google" if self.google_linked else "email"


def avatar_reset_key(avatar_url: str) -> str:
    """같은 아바타를 두 번 초기화해도 알림은 한 번만 쌓이게 하는 ref_key"""
    return "avatar-reset:" + hashlib.sha256(avatar_url.encode()).hexdigest()[:16]
