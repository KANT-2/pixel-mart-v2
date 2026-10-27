import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from src.auth.domain.exceptions import CannotSuspend

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
    suspended: bool = False
    withdrawn: bool = False
    order_count: int = 0
    report_count: int = 0

    @property
    def signup_method(self) -> SignupMethod:
        return "google" if self.google_linked else "email"


def avatar_reset_key(avatar_url: str) -> str:
    """같은 아바타를 두 번 초기화해도 알림은 한 번만 쌓이게 하는 ref_key"""
    return "avatar-reset:" + hashlib.sha256(avatar_url.encode()).hexdigest()[:16]


def check_can_suspend(member: MemberSummary, admin_id: int) -> None:
    """정지할 수 없는 계정이면 CannotSuspend(400). 정지 해제는 언제나 된다."""
    if member.id == admin_id:
        raise CannotSuspend("자기 자신은 정지할 수 없어요.")
    if member.role == "admin":
        raise CannotSuspend("관리자 계정은 정지할 수 없어요.")
    if member.withdrawn:
        raise CannotSuspend("탈퇴한 계정은 정지할 수 없어요.")
