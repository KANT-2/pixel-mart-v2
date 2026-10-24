class InvalidEmail(Exception):
    """이메일 형식이 맞지 않을 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("이메일 형식이 맞지 않아요.")


class WeakPassword(Exception):
    """비밀번호가 길이 규칙에 맞지 않을 때 발생한다."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class InvalidNickname(Exception):
    """닉네임이 비었거나 너무 길 때 발생한다."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class InvalidToken(Exception):
    """토큰이 위조·만료됐거나 필요한 값이 빠졌을 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("다시 로그인해 주세요.")
