from fastapi import Request, status
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
