import logging

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.admin_content.domain.content import FaqNotFound, NoticeNotFound
from src.admin_orders.domain.exceptions import AlreadyResolved, CancelRequestNotFound, InvalidTransition, OrderNotFound
from src.admin_products.domain.exceptions import AdminProductNotFound, InvalidProductCategory
from src.admin_reviews.domain.moderation import ReviewNotFound
from src.admin_trades.domain.moderation import CannotReopen, TradeNotFound
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
from src.badges.domain.badge import BadgeNotFound, BadgeRuleError, NotEarned, NotHolder
from src.coupons.domain.rules import InvalidCoupon
from src.orders.domain.exceptions import EmptyCart, OutOfStock
from src.points.domain.rules import InvalidPointUse
from src.questions.domain.exceptions import (
    AnsweredQuestionNotDeletable,
    InvalidQuestion,
    ProductNotFound,
    QuestionAlreadyAnswered,
    QuestionNotAnswered,
    QuestionNotFound,
)
from src.reports.domain.exceptions import (
    AlreadyReported,
    CannotReport,
    ReportAlreadyHandled,
    ReportNotFound,
    ReportTargetNotFound,
)
from src.returns.domain.rules import AfterDeliveryError, ReturnRequestNotFound

logger = logging.getLogger("uvicorn.error")


class DomainError(Exception):
    """비즈니스 규칙에서 발생하는 기본 예외."""


class NotFoundError(DomainError):
    """대상이 존재하지 않음."""


class ForbiddenError(DomainError):
    """접근 권한이 없음."""


class InvalidStateError(DomainError):
    """현재 상태에서 처리할 수 없음."""


class InvalidInputError(DomainError):
    """입력값이 비즈니스 규칙에 맞지 않음."""


ERROR_STATUS_MAP: dict[type[Exception], int] = {
    EmptyCart: status.HTTP_409_CONFLICT,
    OutOfStock: status.HTTP_409_CONFLICT,
    InvalidPointUse: status.HTTP_400_BAD_REQUEST,
    InvalidCoupon: status.HTTP_400_BAD_REQUEST,
    AfterDeliveryError: status.HTTP_400_BAD_REQUEST,
    ReturnRequestNotFound: status.HTTP_404_NOT_FOUND,
    InvalidEmail: status.HTTP_422_UNPROCESSABLE_CONTENT,
    WeakPassword: status.HTTP_422_UNPROCESSABLE_CONTENT,
    InvalidNickname: status.HTTP_422_UNPROCESSABLE_CONTENT,
    InvalidToken: status.HTTP_401_UNAUTHORIZED,
    LoginFailed: status.HTTP_401_UNAUTHORIZED,
    EmailTaken: status.HTTP_409_CONFLICT,
    NicknameTaken: status.HTTP_409_CONFLICT,
    MemberNotFound: status.HTTP_404_NOT_FOUND,
    CannotWithdraw: status.HTTP_400_BAD_REQUEST,
    CannotSuspend: status.HTTP_400_BAD_REQUEST,
    BadgeNotFound: status.HTTP_404_NOT_FOUND,
    NotEarned: status.HTTP_400_BAD_REQUEST,
    BadgeRuleError: status.HTTP_400_BAD_REQUEST,
    NotHolder: status.HTTP_404_NOT_FOUND,
    TradeNotFound: status.HTTP_404_NOT_FOUND,
    ReviewNotFound: status.HTTP_404_NOT_FOUND,
    CannotReopen: status.HTTP_400_BAD_REQUEST,
    ReportTargetNotFound: status.HTTP_404_NOT_FOUND,
    CannotReport: status.HTTP_400_BAD_REQUEST,
    AlreadyReported: status.HTTP_400_BAD_REQUEST,
    ReportNotFound: status.HTTP_404_NOT_FOUND,
    ReportAlreadyHandled: status.HTTP_409_CONFLICT,
    QuestionNotFound: status.HTTP_404_NOT_FOUND,
    ProductNotFound: status.HTTP_404_NOT_FOUND,
    InvalidQuestion: status.HTTP_422_UNPROCESSABLE_CONTENT,
    QuestionAlreadyAnswered: status.HTTP_409_CONFLICT,
    QuestionNotAnswered: status.HTTP_409_CONFLICT,
    AnsweredQuestionNotDeletable: status.HTTP_409_CONFLICT,
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ForbiddenError: status.HTTP_403_FORBIDDEN,
    InvalidStateError: status.HTTP_400_BAD_REQUEST,
    InvalidInputError: status.HTTP_422_UNPROCESSABLE_CONTENT,
    InvalidTransition: status.HTTP_409_CONFLICT,
    AlreadyResolved: status.HTTP_409_CONFLICT,
    OrderNotFound: status.HTTP_404_NOT_FOUND,
    CancelRequestNotFound: status.HTTP_404_NOT_FOUND,
    AdminProductNotFound: status.HTTP_404_NOT_FOUND,
    InvalidProductCategory: status.HTTP_422_UNPROCESSABLE_CONTENT,
    NoticeNotFound: status.HTTP_404_NOT_FOUND,
    FaqNotFound: status.HTTP_404_NOT_FOUND,
}


async def domain_error_handler(
    _request: Request,
    exc: Exception,
) -> JSONResponse:
    """도메인 예외를 기존 API와 같은 HTTP 오류 형태로 변환."""
    status_code = ERROR_STATUS_MAP.get(
        type(exc),
        status.HTTP_400_BAD_REQUEST,
    )
    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc)},
    )


# 입력 형식 오류(422) — Pydantic 기본 영어 문구와 보낸 값(비밀번호 등)을 그대로 돌려주지 않고 한글 안내만 보낸다
FIELD_LABELS = {
    "email": "이메일",
    "password": "비밀번호",
    "newPassword": "새 비밀번호",
    "currentPassword": "지금 비밀번호",
    "nickname": "닉네임",
    "title": "제목",
    "content": "내용",
    "answer": "답변",
    "recipientName": "받는 사람",
    "phone": "휴대폰 번호",
    "postalCode": "우편번호",
    "address": "주소",
    "addressDetail": "상세 주소",
    "quantity": "수량",
    "rating": "별점",
    "reason": "사유",
    "page": "페이지",
    "size": "개수",
}


def _validation_message(error: dict) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx") or {}
    if kind == "missing":
        return "꼭 입력해 주세요."
    if kind == "string_too_short":
        return "비어 있어요." if ctx.get("min_length") == 1 else f"{ctx.get('min_length')}자 이상 입력해 주세요."
    if kind == "string_too_long":
        return f"{ctx.get('max_length')}자 이하로 입력해 주세요."
    if kind in ("greater_than_equal", "greater_than"):
        return f"{ctx.get('ge', ctx.get('gt'))} 이상이어야 해요."
    if kind in ("less_than_equal", "less_than"):
        return f"{ctx.get('le', ctx.get('lt'))} 이하여야 해요."
    if kind in ("int_parsing", "int_type", "float_parsing"):
        return "숫자로 입력해 주세요."
    if kind == "value_error":
        # 우리 검증기가 던진 한글 문구("Value error, ..." 접두어 제외)만 그대로 쓴다
        message = str(error.get("msg", "")).removeprefix("Value error, ")
        return message if any("가" <= ch <= "힣" for ch in message) else "형식이 올바르지 않아요."
    return "형식이 올바르지 않아요."


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = []
    causes = []
    for error in exc.errors():
        loc = [str(part) for part in error.get("loc", ()) if part not in ("body", "query", "path")]
        field = loc[-1] if loc else ""
        errors.append({"field": field, "message": _validation_message(error)})
        causes.append((field, error.get("type")))
    # 자세한 원인은 서버 로그로만 — 입력값은 남기지 않는다
    logger.info("422 %s %s %s", request.method, request.url.path, causes)
    first = errors[0] if errors else {"field": "", "message": "입력값을 확인해 주세요."}
    label = FIELD_LABELS.get(first["field"], "")
    detail = f"{label}: {first['message']}" if label else f"입력값을 확인해 주세요. {first['message']}"
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": detail, "errors": errors})
