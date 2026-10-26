# 관리자 주문 도메인 전용 예외 — fastapi/sqlalchemy/pydantic 없이 순수 파이썬으로만 작성한다


class InvalidTransition(Exception):
    """더 넘길 수 없는 상태에서 advance()를 불렀을 때"""

    def __init__(self, message: str = "더 넘길 수 없는 상태예요.") -> None:
        # 호출부가 메시지를 안 넘겨도 기본 한글 메시지가 붙도록 한다
        super().__init__(message)


class AlreadyResolved(Exception):
    """이미 승인/거절이 끝난 취소 요청을 다시 처리하려 했을 때"""

    def __init__(self, message: str = "이미 처리된 요청이에요.") -> None:
        # 호출부가 메시지를 안 넘겨도 기본 한글 메시지가 붙도록 한다
        super().__init__(message)


class OrderNotFound(Exception):
    """주어진 id의 주문이 없을 때"""

    def __init__(self, message: str = "주문을 찾을 수 없어요.") -> None:
        # 호출부가 메시지를 안 넘겨도 기본 한글 메시지가 붙도록 한다
        super().__init__(message)


class CancelRequestNotFound(Exception):
    """주어진 id의 취소 요청이 없을 때"""

    def __init__(self, message: str = "취소 요청을 찾을 수 없어요.") -> None:
        # 호출부가 메시지를 안 넘겨도 기본 한글 메시지가 붙도록 한다
        super().__init__(message)
