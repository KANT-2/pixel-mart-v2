from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class IssuedToken:
    """발급된 로그인 토큰의 내용. jti는 로그아웃 블랙리스트에서 이 토큰만 골라내는 고유값이다."""

    user_id: int
    jti: str
    expires_at: datetime

    def is_expired(self, now: datetime) -> bool:
        return now >= self.expires_at
