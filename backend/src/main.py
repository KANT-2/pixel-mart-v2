import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.routers import (
    ai_avatar,
    auth,
    cancel_requests,
    cart,
    compat,
    faqs,
    gifts,
    health,
    local,
    local_trades,
    notifications,
    orders,
    products,
    reviews,
    trade_requests,
    users,
    wishlist,
)
from src.admin_orders.domain.exceptions import AlreadyResolved, CancelRequestNotFound, InvalidTransition, OrderNotFound
from src.admin_orders.presentation import cancel_router as admin_cancel_api
from src.admin_orders.presentation import router as admin_orders_api
from src.auth.domain.exceptions import (
    EmailTaken,
    InvalidEmail,
    InvalidNickname,
    InvalidToken,
    LoginFailed,
    NicknameTaken,
    WeakPassword,
)
from src.auth.presentation import router as auth_api
from src.common.errors import DomainError, domain_error_handler
from src.common.logging import log_requests
from src.database import engine
from src.orders.domain.exceptions import EmptyCart, OutOfStock
from src.orders.presentation import router as orders_api
from src.questions.domain.exceptions import (
    AnsweredQuestionNotDeletable,
    InvalidQuestion,
    ProductNotFound,
    QuestionAlreadyAnswered,
    QuestionNotFound,
)
from src.questions.presentation import router as questions_api


# FastAPI 서버의 시작 및 종료 과정 관리
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Uvicorn 기본 접근 로그 비활성화
    # 쿼리스트링 노출 및 중복 로그 방지
    logging.getLogger("uvicorn.access").disabled = True

    try:
        # 서버 시작 시 DB 연결 확인 (데이터 변경 없음)
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

        yield

    finally:
        # 서버 종료 시 DB 연결 자원 정리
        await engine.dispose()


# FastAPI 애플리케이션 생성
app = FastAPI(
    title="PIXEL MART API",
    version="0.1.0",
    lifespan=lifespan,
    # 프론트(3000)의 /api 프록시에서도 문서를 볼 수 있도록 설정
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)


# 공통 도메인 예외를 HTTP 오류 응답으로 변환
app.add_exception_handler(DomainError, domain_error_handler)
for order_error in (EmptyCart, OutOfStock):
    app.add_exception_handler(order_error, domain_error_handler)
for admin_order_error in (InvalidTransition, AlreadyResolved, OrderNotFound, CancelRequestNotFound):
    app.add_exception_handler(admin_order_error, domain_error_handler)
for auth_error in (InvalidEmail, WeakPassword, InvalidNickname, InvalidToken, LoginFailed, EmailTaken, NicknameTaken):
    app.add_exception_handler(auth_error, domain_error_handler)
for question_error in (
    QuestionNotFound,
    ProductNotFound,
    InvalidQuestion,
    QuestionAlreadyAnswered,
    AnsweredQuestionNotDeletable,
):
    app.add_exception_handler(question_error, domain_error_handler)


# 프론트엔드의 직접 API 호출을 위한 CORS 설정
# 허용 출처는 환경변수 FRONTEND_URL에서 가져옴
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Google OAuth 인증 과정의 임시 세션 관리
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.jwt_secret,
    session_cookie="pm_oauth",
    max_age=600,
    https_only=not settings.is_local,
)


# HTTP 요청 로깅 미들웨어
# 마지막에 등록하여 CORS 사전 요청을 포함한 요청을 기록
# 메서드, 경로, 상태 코드, 처리 시간만 기록
app.middleware("http")(log_requests)


# 기존 API 라우터 등록
# 모든 API 경로는 /api로 시작
for router in (
    health.router,
    auth.router,
    products.router,
    faqs.router,
    cart.router,
    orders.dev_router,
    cancel_requests.router,
    cancel_requests.dev_router,
    users.router,
    ai_avatar.router,
    gifts.router,
    wishlist.router,
    local.router,
    local_trades.router,
    trade_requests.router,
    reviews.router,
    compat.router,
    notifications.router,
):
    app.include_router(router, prefix="/api")


# 새 4계층 라우터 등록
app.include_router(auth_api.router, prefix="/api")
app.include_router(auth_api.admin_router, prefix="/api")
app.include_router(orders_api.router, prefix="/api")
app.include_router(admin_cancel_api.router, prefix="/api")
app.include_router(admin_orders_api.router, prefix="/api")
app.include_router(questions_api.router, prefix="/api")
app.include_router(questions_api.admin_router, prefix="/api")
