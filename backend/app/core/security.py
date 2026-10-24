from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Response

from app.core.config import settings
from src.auth.infrastructure.jwt import issue_token

# 로그인 세션은 JWT를 httpOnly 쿠키에 담아 전달합니다.
# 프론트는 Next.js rewrites(/api → :8000)로 같은 주소처럼 호출하므로 쿠키가 자동으로 따라갑니다.
SESSION_COOKIE = "pm_session"
ALGORITHM = "HS256"


def create_access_token(user_id: int) -> str:
    # 구글·개발용 로그인도 이메일 로그인과 같은 JWT(+jti)를 받아 로그아웃 블랙리스트가 똑같이 걸린다
    raw, _ = issue_token(user_id)
    return raw


SIGNUP_COOKIE = "pm_signup"
SIGNUP_MINUTES = 15


def create_signup_token(google_sub: str, email: str, name: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=SIGNUP_MINUTES)
    payload = {"typ": "signup", "gsub": google_sub, "email": email, "name": name, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_signup_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload if payload.get("typ") == "signup" else None


def set_signup_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SIGNUP_COOKIE, token, max_age=SIGNUP_MINUTES * 60, httponly=True, samesite="lax", secure=not settings.is_local
    )


def set_session_cookie(response: Response, user_id: int) -> None:
    set_session_token(response, create_access_token(user_id))


def set_session_token(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=not settings.is_local,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE)
    response.delete_cookie(SIGNUP_COOKIE)
