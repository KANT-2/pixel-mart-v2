from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.security import clear_session_cookie, set_session_token
from app.models import User
from app.schemas.common import Message
from app.schemas.user import UserOut
from src.auth.application.service import AuthService
from src.auth.domain.exceptions import InvalidToken
from src.auth.infrastructure.repositories import TokenBlacklistRepository, UserRepository
from src.auth.presentation.schemas import SignupRequest, TokenResponse
from src.common.auth import CurrentUser, DbSession, RawToken, authenticate

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db: DbSession) -> AuthService:
    return AuthService(UserRepository(db), TokenBlacklistRepository(db), db)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


@router.post(
    "/signup",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="이메일 회원가입 (중복 이메일·닉네임 409)",
)
async def signup(body: SignupRequest, service: AuthServiceDep, db: DbSession):
    account = await service.signup(body.email, body.password, body.nickname)
    return await db.get(User, account.id)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="로그인 (OAuth2 form: username=이메일) → 토큰 + pm_session 쿠키",
)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], response: Response, service: AuthServiceDep):
    raw, _ = await service.login(form.username, form.password)
    set_session_token(response, raw)
    return TokenResponse(access_token=raw)


@router.post("/logout", response_model=Message, summary="로그아웃 → 이 토큰을 블랙리스트에 (같은 토큰은 이제 401)")
async def logout(response: Response, service: AuthServiceDep, db: DbSession, raw: RawToken):
    # 이미 만료·로그아웃된 토큰이어도 쿠키는 지우고 200 (화면에서 로그아웃이 실패하지 않게)
    if raw:
        try:
            _, token = await authenticate(db, raw)
        except InvalidToken:
            token = None
        if token is not None:
            await service.logout(token)
    clear_session_cookie(response)
    return Message(message="로그아웃되었습니다.")


@router.get("/me", response_model=UserOut, summary="내 정보 (role 포함)")
async def me(user: CurrentUser):
    return user
