import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_swagger_ui_oauth2_redirect_html
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
from src.addresses.presentation import router as addresses_api
from src.admin_content.domain.content import FaqNotFound, NoticeNotFound
from src.admin_content.presentation import router as admin_content_api
from src.admin_orders.domain.exceptions import AlreadyResolved, CancelRequestNotFound, InvalidTransition, OrderNotFound
from src.admin_orders.presentation import cancel_router as admin_cancel_api
from src.admin_orders.presentation import router as admin_orders_api
from src.admin_products.domain.exceptions import AdminProductNotFound, InvalidProductCategory
from src.admin_products.presentation import router as admin_products_api
from src.admin_summary.presentation import router as admin_summary_api
from src.admin_trades.domain.moderation import CannotReopen, TradeNotFound
from src.admin_trades.presentation import router as admin_trades_api
from src.auth.domain.exceptions import (
    CannotSuspend,
    CannotWithdraw,
    EmailTaken,
    InvalidEmail,
    InvalidNickname,
    InvalidToken,
    LoginFailed,
    MemberNotFound,
    NicknameTaken,
    WeakPassword,
)
from src.auth.presentation import router as auth_api
from src.badges.domain.badge import BadgeNotFound, BadgeRuleError, NotEarned, NotHolder
from src.badges.presentation import router as badges_api
from src.common.errors import DomainError, domain_error_handler
from src.common.logging import log_requests
from src.coupons.domain.rules import InvalidCoupon
from src.coupons.presentation import router as coupons_api
from src.database import engine
from src.orders.domain.exceptions import EmptyCart, OutOfStock
from src.orders.presentation import router as orders_api
from src.points.domain.rules import InvalidPointUse
from src.points.presentation import router as points_api
from src.questions.domain.exceptions import (
    AnsweredQuestionNotDeletable,
    InvalidQuestion,
    ProductNotFound,
    QuestionAlreadyAnswered,
    QuestionNotFound,
)
from src.questions.presentation import router as questions_api
from src.reports.domain.exceptions import (
    AlreadyReported,
    CannotReport,
    ReportAlreadyHandled,
    ReportNotFound,
    ReportTargetNotFound,
)
from src.reports.presentation import router as reports_api
from src.returns.domain.rules import AfterDeliveryError, ReturnRequestNotFound
from src.returns.presentation import router as returns_api


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
    docs_url=None,  # 아래에서 Swagger UI 버전을 고정해 직접 연다
    openapi_url="/api/openapi.json",
)


# Swagger UI는 CDN 최신판(5.34)이 이 문서를 중간까지만 그려서 확인된 버전으로 고정
SWAGGER_UI_CDN = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14"
SWAGGER_OAUTH2_REDIRECT = "/api/docs/oauth2-redirect"


@app.get("/api/docs", include_in_schema=False)
async def swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/api/openapi.json",
        title=f"{app.title} - Swagger UI",
        oauth2_redirect_url=SWAGGER_OAUTH2_REDIRECT,
        swagger_js_url=f"{SWAGGER_UI_CDN}/swagger-ui-bundle.js",
        swagger_css_url=f"{SWAGGER_UI_CDN}/swagger-ui.css",
    )


@app.get(SWAGGER_OAUTH2_REDIRECT, include_in_schema=False)
async def swagger_ui_redirect():
    return get_swagger_ui_oauth2_redirect_html()


# 공통 도메인 예외를 HTTP 오류 응답으로 변환
app.add_exception_handler(DomainError, domain_error_handler)
for order_error in (EmptyCart, OutOfStock, InvalidPointUse, InvalidCoupon, AfterDeliveryError, ReturnRequestNotFound):
    app.add_exception_handler(order_error, domain_error_handler)
for admin_order_error in (InvalidTransition, AlreadyResolved, OrderNotFound, CancelRequestNotFound):
    app.add_exception_handler(admin_order_error, domain_error_handler)
for auth_error in (
    InvalidEmail,
    WeakPassword,
    InvalidNickname,
    InvalidToken,
    LoginFailed,
    EmailTaken,
    NicknameTaken,
    MemberNotFound,
    CannotWithdraw,
    CannotSuspend,
):
    app.add_exception_handler(auth_error, domain_error_handler)
for question_error in (
    QuestionNotFound,
    ProductNotFound,
    InvalidQuestion,
    QuestionAlreadyAnswered,
    AnsweredQuestionNotDeletable,
):
    app.add_exception_handler(question_error, domain_error_handler)
for admin_product_error in (AdminProductNotFound, InvalidProductCategory):
    app.add_exception_handler(admin_product_error, domain_error_handler)
for content_error in (NoticeNotFound, FaqNotFound):
    app.add_exception_handler(content_error, domain_error_handler)

for report_error in (AlreadyReported, CannotReport, ReportAlreadyHandled, ReportNotFound, ReportTargetNotFound):
    app.add_exception_handler(report_error, domain_error_handler)
for admin_trade_error in (TradeNotFound, CannotReopen):
    app.add_exception_handler(admin_trade_error, domain_error_handler)
for badge_error in (BadgeNotFound, NotEarned, BadgeRuleError, NotHolder):
    app.add_exception_handler(badge_error, domain_error_handler)

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
app.include_router(auth_api.users_router, prefix="/api")
app.include_router(badges_api.router, prefix="/api")
app.include_router(badges_api.admin_router, prefix="/api")
app.include_router(admin_trades_api.router, prefix="/api")
app.include_router(reports_api.router, prefix="/api")
app.include_router(reports_api.admin_router, prefix="/api")
app.include_router(orders_api.router, prefix="/api")
app.include_router(points_api.router, prefix="/api")
app.include_router(addresses_api.router, prefix="/api")
app.include_router(coupons_api.router, prefix="/api")
app.include_router(returns_api.router, prefix="/api")
app.include_router(returns_api.admin_router, prefix="/api")
app.include_router(admin_cancel_api.router, prefix="/api")
app.include_router(admin_orders_api.router, prefix="/api")
app.include_router(admin_summary_api.router, prefix="/api")
app.include_router(questions_api.router, prefix="/api")
app.include_router(questions_api.admin_router, prefix="/api")
app.include_router(admin_products_api.router, prefix="/api")
app.include_router(admin_content_api.router, prefix="/api")
app.include_router(admin_content_api.admin_router, prefix="/api")
