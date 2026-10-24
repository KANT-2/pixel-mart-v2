import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from src.auth.domain.exceptions import InvalidToken
from src.auth.domain.token import IssuedToken

ALGORITHM = "HS256"


def issue_token(
    user_id: int,
    *,
    secret: str | None = None,
    expire_minutes: int | None = None,
    now: datetime | None = None,
) -> tuple[str, IssuedToken]:
    """로그인 토큰을 만든다. jti(uuid4)를 넣어 로그아웃 때 이 토큰만 블랙리스트에 올릴 수 있게 한다."""
    issued_at = now or datetime.now(UTC)
    minutes = settings.jwt_expire_minutes if expire_minutes is None else expire_minutes
    token = IssuedToken(user_id=user_id, jti=uuid.uuid4().hex, expires_at=issued_at + timedelta(minutes=minutes))
    payload = {"sub": str(user_id), "jti": token.jti, "exp": token.expires_at, "iat": issued_at}
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm=ALGORITHM), token


def decode_token(raw: str, *, secret: str | None = None) -> IssuedToken:
    """서명·만료를 확인하고 내용을 꺼낸다. 하나라도 틀리면 InvalidToken (→ 401)."""
    try:
        payload = jwt.decode(
            raw,
            secret or settings.jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "jti", "exp"]},
        )
        return IssuedToken(
            user_id=int(payload["sub"]),
            jti=payload["jti"],
            expires_at=datetime.fromtimestamp(payload["exp"], UTC),
        )
    except (jwt.PyJWTError, ValueError) as exc:
        raise InvalidToken() from exc
