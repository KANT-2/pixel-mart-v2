import re

MAX_ADDRESSES = 10  # 한 사람이 저장해 둘 수 있는 배송지 수

# 배송 연락처는 휴대폰 11자리만 (택배 문자를 받을 수 있게) — 프론트 isValidPhone과 같은 규칙
_PHONE = re.compile(r"^(01[016789])(\d{4})(\d{4})$")
_POSTAL_CODE = re.compile(r"^\d{5}$")


def normalize_phone(raw: str) -> str:
    """하이픈·공백을 빼고 검사한 뒤 010-1234-5678 모양으로 맞춘다"""
    digits = re.sub(r"[\s-]", "", raw)
    match = _PHONE.match(digits)
    if not match:
        raise ValueError("연락처는 휴대폰 번호 11자리를 010-1234-5678처럼 입력해 주세요.")
    return "-".join(match.groups())


def check_postal_code(raw: str) -> str:
    code = raw.strip()
    if not _POSTAL_CODE.match(code):
        raise ValueError("우편번호는 숫자 5자리예요.")
    return code
