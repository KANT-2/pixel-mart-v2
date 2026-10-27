import re

MAX_ADDRESSES = 10  # 한 사람이 저장해 둘 수 있는 배송지 수

_PHONE = re.compile(r"^(0\d{1,2})(\d{3,4})(\d{4})$")
_POSTAL_CODE = re.compile(r"^\d{5}$")


def normalize_phone(raw: str) -> str:
    """하이픈·공백을 빼고 검사한 뒤 010-1234-5678 모양으로 맞춘다"""
    digits = re.sub(r"[\s-]", "", raw)
    match = _PHONE.match(digits)
    if not match:
        raise ValueError("연락처는 010-1234-5678처럼 숫자로 입력해 주세요.")
    return "-".join(match.groups())


def check_postal_code(raw: str) -> str:
    code = raw.strip()
    if not _POSTAL_CODE.match(code):
        raise ValueError("우편번호는 숫자 5자리예요.")
    return code
