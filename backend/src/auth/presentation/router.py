from datetime import UTC, datetime
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import clear_session_cookie, set_session_token
from app.models import User
from app.schemas.common import Message, Page
from app.schemas.user import UserOut
from src.auth.application.admin_users import AdminUserService, AvatarResetService, SuspendService
from src.auth.application.password import PasswordError, change_password, request_reset, reset_password
from src.auth.application.service import AuthService
from src.auth.application.withdrawal import WithdrawService
from src.auth.domain.exceptions import InvalidToken
from src.auth.domain.member import MemberSummary
from src.auth.infrastructure.repositories import MemberRepository, TokenBlacklistRepository, UserRepository
from src.auth.infrastructure.withdrawal import WithdrawRepository
from src.auth.presentation.schemas import (
    AdminUserOut,
    AvatarResetRequest,
    PasswordChangeRequest,
    PasswordResetConfirm,
    PasswordResetOut,
    PasswordResetRequest,
    SignupRequest,
    SuspendRequest,
    TokenResponse,
    WithdrawRequest,
)
from src.common.auth import AdminUser, CurrentUser, DbSession, RawToken, authenticate
from src.common.pagination import Pagination

router = APIRouter(prefix="/auth", tags=["auth"])
admin_router = APIRouter(prefix="/admin/users", tags=["admin"])
users_router = APIRouter(prefix="/users", tags=["users"])


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


@admin_router.get(
    "", response_model=Page[AdminUserOut], summary="[관리자] 회원 목록 (닉네임·이메일 검색 · 역할 필터 · 페이지)"
)
async def list_users(
    _admin: AdminUser,
    db: DbSession,
    pagination: Pagination,
    q: Annotated[str | None, Query(max_length=100, description="닉네임·이메일 부분 일치")] = None,
    role: Annotated[Literal["user", "admin"] | None, Query()] = None,
    suspended: Annotated[bool | None, Query(description="정지된 회원만(true) · 아닌 회원만(false)")] = None,
):
    members, total = await AdminUserService(MemberRepository(db)).list_members(
        q, role, pagination.page, pagination.size, suspended
    )
    return Page[AdminUserOut](
        items=[_admin_user_out(m) for m in members],
        total=total,
        page=pagination.page,
        size=pagination.size,
        total_pages=max(1, ceil(total / pagination.size)),
    )


@admin_router.post(
    "/{user_id}/avatar-reset", response_model=AdminUserOut, summary="[관리자] 아바타 초기화 (본인에게 알림)"
)
async def reset_avatar(user_id: int, _admin: AdminUser, db: DbSession, body: AvatarResetRequest | None = None):
    member = await AvatarResetService(MemberRepository(db), db).reset(user_id, body.memo if body else None)
    return _admin_user_out(member)


@admin_router.patch("/{user_id}", response_model=AdminUserOut, summary="[관리자] 사용자 정지 · 해제")
async def set_suspended(user_id: int, body: SuspendRequest, admin: AdminUser, db: DbSession):
    member = await SuspendService(MemberRepository(db), db).set_suspended(user_id, body.suspended, admin.id)
    return _admin_user_out(member)


def _admin_user_out(m: MemberSummary) -> AdminUserOut:
    return AdminUserOut(
        id=m.id,
        email="탈퇴한 계정" if m.withdrawn else m.email,
        nickname=m.nickname,
        role=m.role,
        signup_method=m.signup_method,
        created_at=m.created_at,
        avatar_url=m.avatar_url,
        suspended=m.suspended,
        withdrawn=m.withdrawn,
        order_count=m.order_count,
        report_count=m.report_count,
    )


@users_router.post("/me/withdraw", response_model=Message, summary="회원 탈퇴 (진행 중 주문이 있으면 400)")
async def withdraw(_body: WithdrawRequest, response: Response, user: CurrentUser, db: DbSession, raw: RawToken):
    _, token = await authenticate(db, raw) if raw else (None, None)
    service = WithdrawService(WithdrawRepository(db), TokenBlacklistRepository(db), db)
    await service.withdraw(user.id, token, datetime.now(UTC))
    clear_session_cookie(response)
    return Message(message="탈퇴했어요. 그동안 함께해 줘서 고마워요.")


@router.post("/password", response_model=Message, summary="비밀번호 변경 (이메일 가입 계정 · 지금 비밀번호 확인)")
async def update_password(body: PasswordChangeRequest, user: CurrentUser, db: DbSession) -> Message:
    try:
        await change_password(db, user, body.current_password, body.new_password)
    except PasswordError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from None
    return Message(message="비밀번호를 바꿨어요.")


RESET_SENT = "가입한 이메일이면 비밀번호 재설정 링크를 보냈어요. 30분 안에 열어 주세요."


@router.post("/password-reset", response_model=PasswordResetOut, summary="비밀번호 재설정 링크 요청")
async def ask_password_reset(body: PasswordResetRequest, db: DbSession) -> PasswordResetOut:
    token = await request_reset(db, body.email)
    # 가입 여부를 드러내지 않도록 항상 같은 안내 — 메일 서버가 없는 로컬에서만 링크를 응답에 담는다
    reset_url = f"{settings.frontend_url}/reset-password?token={token}" if token and settings.is_local else None
    return PasswordResetOut(message=RESET_SENT, reset_url=reset_url)


@router.post("/password-reset/confirm", response_model=Message, summary="재설정 링크로 새 비밀번호 저장")
async def confirm_password_reset(body: PasswordResetConfirm, db: DbSession) -> Message:
    try:
        await reset_password(db, body.token, body.new_password)
    except PasswordError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from None
    return Message(message="새 비밀번호로 바꿨어요. 다시 로그인해 주세요.")
