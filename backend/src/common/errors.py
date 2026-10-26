from fastapi import Request, status
from fastapi.responses import JSONResponse

from src.auth.domain.exceptions import (
    EmailTaken,
    InvalidEmail,
    InvalidNickname,
    InvalidToken,
    LoginFailed,
    NicknameTaken,
    WeakPassword,
)
from src.orders.domain.exceptions import EmptyCart, OutOfStock
from src.questions.domain.exceptions import (
    AnsweredQuestionNotDeletable,
    InvalidQuestion,
    ProductNotFound,
    QuestionAlreadyAnswered,
    QuestionNotFound,
)


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
    InvalidEmail: status.HTTP_422_UNPROCESSABLE_CONTENT,
    WeakPassword: status.HTTP_422_UNPROCESSABLE_CONTENT,
    InvalidNickname: status.HTTP_422_UNPROCESSABLE_CONTENT,
    InvalidToken: status.HTTP_401_UNAUTHORIZED,
    LoginFailed: status.HTTP_401_UNAUTHORIZED,
    EmailTaken: status.HTTP_409_CONFLICT,
    NicknameTaken: status.HTTP_409_CONFLICT,
    QuestionNotFound: status.HTTP_404_NOT_FOUND,
    ProductNotFound: status.HTTP_404_NOT_FOUND,
    InvalidQuestion: status.HTTP_422_UNPROCESSABLE_CONTENT,
    QuestionAlreadyAnswered: status.HTTP_409_CONFLICT,
    AnsweredQuestionNotDeletable: status.HTTP_409_CONFLICT,
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ForbiddenError: status.HTTP_403_FORBIDDEN,
    InvalidStateError: status.HTTP_400_BAD_REQUEST,
    InvalidInputError: status.HTTP_422_UNPROCESSABLE_CONTENT,
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
