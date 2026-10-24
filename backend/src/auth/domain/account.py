import re
from dataclasses import dataclass

from .exceptions import InvalidEmail, InvalidNickname, WeakPassword

# @ 앞뒤에 공백 없는 글자가 있고, 도메인에 점이 하나 이상 있으면 통과
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
EMAIL_MAX_LENGTH = 320  # users.email 컬럼 길이
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_BYTES = 72  # bcrypt는 앞 72바이트만 쓰고, 5.0부터는 넘으면 오류를 낸다
NICKNAME_MAX_LENGTH = 30  # users.nickname 컬럼 길이
ADMIN_ROLE = "admin"

def normalize_email(email: str) -> str:
    """앞뒤 공백을 지우고 소문자로 맞춘 뒤 형식을 검사한다."""
    value = email.strip().lower()
    if len(value) > EMAIL_MAX_LENGTH or not EMAIL_PATTERN.match(value):
        raise InvalidEmail()
    return value


def check_password(raw: str) -> None:
    """가입·비밀번호 변경 때 평문 비밀번호 길이 규칙을 검사한다."""
    if len(raw) < PASSWORD_MIN_LENGTH:
        raise WeakPassword(f"비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 해요.")
    if len(raw.encode()) > PASSWORD_MAX_BYTES:
        raise WeakPassword("비밀번호가 너무 길어요. (영문 기준 72자 이하)")


def normalize_nickname(nickname: str) -> str:
    value = nickname.strip()
    if not value:
        raise InvalidNickname("닉네임을 입력해 주세요.")
    if len(value) > NICKNAME_MAX_LENGTH:
        raise InvalidNickname(f"닉네임은 {NICKNAME_MAX_LENGTH}자 이하로 정해 주세요.")
    return value


@dataclass(frozen=True)
class Account:
    """로그인 주체. 비밀번호는 해시만 들고 있다 (구글 가입자는 None)."""

    id: int | None
    email: str
    nickname: str
    password_hash: str | None = None
    role: str = "user"

    def __post_init__(self) -> None:
        object.__setattr__(self, "email", normalize_email(self.email))
        object.__setattr__(self, "nickname", normalize_nickname(self.nickname))

    @property
    def is_admin(self) -> bool:
        return self.role == ADMIN_ROLE

    @property
    def can_password_login(self) -> bool:
        return self.password_hash is not None
