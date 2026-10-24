import bcrypt


def hash_password(raw: str) -> str:
    """평문 비밀번호를 bcrypt 해시로 바꾼다. 같은 비밀번호도 매번 다른 salt라 결과가 달라진다."""
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()


def verify_password(raw: str, hashed: str) -> bool:
    """평문이 해시와 맞는지 확인한다. 해시가 깨졌거나 72바이트를 넘으면 오류 대신 False."""
    try:
        return bcrypt.checkpw(raw.encode(), hashed.encode())
    except ValueError:
        return False
