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


def can_forget_blacklisted(expires_at: datetime, now: datetime) -> bool:
    """로그아웃한 토큰의 블랙리스트 줄은 그 토큰이 **완전히 만료된 뒤에만** 지워도 된다.

    만료 전에 지우면 로그아웃한 토큰이 다시 통과해요 (같은 토큰 401이 깨짐).
    JWT는 만료 시각과 같은 순간까지는 아직 유효하므로 "같거나 지남"이 아니라 "지남"으로 판단한다.
    """
    return expires_at < now
