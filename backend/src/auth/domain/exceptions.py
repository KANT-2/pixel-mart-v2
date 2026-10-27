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


class EmailTaken(Exception):
    """이미 가입한 이메일로 다시 가입할 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("이미 가입한 이메일이에요.")


class NicknameTaken(Exception):
    """다른 사람이 쓰는 닉네임일 때 발생한다 (대소문자 구분 없음)."""

    def __init__(self) -> None:
        super().__init__("이미 사용 중인 닉네임입니다.")


class LoginFailed(Exception):
    """이메일이 없거나 비밀번호가 틀릴 때. 어느 쪽인지 알려 주지 않으려고 문구를 하나로 쓴다."""

    def __init__(self) -> None:
        super().__init__("이메일 또는 비밀번호가 맞지 않아요.")


class MemberNotFound(Exception):
    """관리자가 찾는 회원이 없을 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("회원을 찾을 수 없어요.")


class CannotWithdraw(Exception):
    """진행 중인 주문이 있거나 관리자 계정이라 탈퇴할 수 없을 때 발생한다."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class CannotSuspend(Exception):
    """자기 자신 · 관리자 · 탈퇴 계정을 정지하려 할 때 발생한다."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
