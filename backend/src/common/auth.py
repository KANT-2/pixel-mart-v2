"""모든 기능이 쓰는 로그인 확인 의존성 (입장권 검사원)

사용 예:
    async def write(..., user: CurrentUser): ...   # 로그인 필요
    async def advance(..., admin: AdminUser): ...  # 관리자만 (아니면 404)
"""

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import SESSION_COOKIE
from app.models import User
from src.auth.domain.account import ADMIN_ROLE
from src.auth.domain.exceptions import InvalidToken
from src.auth.domain.token import IssuedToken
from src.auth.infrastructure.jwt import decode_token
from src.auth.infrastructure.repositories import TokenBlacklistRepository
from src.database import get_db

DbSession = Annotated[AsyncSession, Depends(get_db)]

# Swagger Authorize 버튼이 이 주소로 로그인한다. 헤더가 없어도 쿠키로 확인하므로 auto_error=False
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


async def get_raw_token(
    bearer: Annotated[str | None, Depends(oauth2_scheme)] = None,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> str | None:
    """Authorization: Bearer 헤더가 먼저, 없으면 pm_session 쿠키"""
    return bearer or session_token


RawToken = Annotated[str | None, Depends(get_raw_token)]


async def authenticate(db: AsyncSession, raw: str) -> tuple[User, IssuedToken]:
    """서명·만료 → 블랙리스트 → 사용자 순서로 확인. 하나라도 틀리면 InvalidToken (401 "다시 로그인해 주세요.")"""
    token = decode_token(raw)
    if await TokenBlacklistRepository(db).contains(token.jti):
        raise InvalidToken()
    user = await db.get(User, token.user_id)
    if user is None:
        raise InvalidToken()
    return user, token


async def get_optional_user(db: DbSession, raw: RawToken) -> User | None:
    # 공개 화면은 오래된·로그아웃한 쿠키가 있어도 막지 않고 비로그인으로 본다
    if not raw:
        return None
    try:
        user, _ = await authenticate(db, raw)
    except InvalidToken:
        return None
    return user


async def get_current_user(db: DbSession, raw: RawToken) -> User:
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다.")
    user, _ = await authenticate(db, raw)
    return user


async def get_admin_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    # 관리자 화면이 있다는 것 자체를 숨기려고 403 대신 404
    if user.role != ADMIN_ROLE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "페이지를 찾을 수 없어요.")
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(get_admin_user)]
