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

    @property
    def signup_method(self) -> SignupMethod:
        return "google" if self.google_linked else "email"
