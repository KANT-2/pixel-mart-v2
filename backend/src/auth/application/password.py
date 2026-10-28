# 비밀번호 변경 · 재설정 — 이메일 가입 계정만 (구글 가입자는 비밀번호가 없다)
import hashlib
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from src.auth.domain.account import Account, check_password
from src.auth.domain.exceptions import WeakPassword
from src.auth.infrastructure.hasher import hash_password, verify_password
from src.auth.infrastructure.repositories import UserRepository

RESET_PURPOSE = "password_reset"
RESET_MINUTES = 30


class PasswordError(Exception):
    """지금 비밀번호가 틀렸거나 재설정 링크를 쓸 수 없음 (400)"""


def _fingerprint(password_hash: str) -> str:
    # 비밀번호가 바뀌면 지문이 달라져서, 한 번 쓴 재설정 링크는 다시 쓸 수 없다
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def issue_reset_token(account: Account, now: datetime | None = None) -> str:
    issued_at = now or datetime.now(UTC)
    payload = {
        "sub": str(account.id),
        "purpose": RESET_PURPOSE,
        "fp": _fingerprint(account.password_hash or ""),
        "exp": issued_at + timedelta(minutes=RESET_MINUTES),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


# 조회·저장은 UserRepository에 맡기고, 여기서는 규칙 확인 → 해시 저장 → commit 순서만 지휘한다
async def change_password(db: AsyncSession, user_id: int, current: str, new: str) -> None:
    users = UserRepository(db)
    account = await users.get_by_id(user_id)
    if account is None or account.password_hash is None:
        raise PasswordError("구글로 가입한 계정은 비밀번호가 없어요.")
    if not verify_password(current, account.password_hash):
        raise PasswordError("지금 비밀번호가 맞지 않아요.")
    if current == new:
        raise WeakPassword("지금과 다른 비밀번호를 입력해 주세요.")
    check_password(new)
    await users.set_password_hash(user_id, hash_password(new))
    await db.commit()


async def request_reset(db: AsyncSession, email: str) -> str | None:
    """재설정 토큰 — 없는 이메일·구글 가입자는 None (화면에는 같은 안내를 보여 준다)"""
    account = await UserRepository(db).get_active_by_email(email.strip())
    if account is None or account.password_hash is None:
        return None
    return issue_reset_token(account)


async def reset_password(db: AsyncSession, token: str, new: str) -> None:
    expired = PasswordError("재설정 링크가 만료됐거나 이미 사용됐어요. 다시 요청해 주세요.")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["sub", "exp"]})
    except jwt.PyJWTError:
        raise expired from None
    if payload.get("purpose") != RESET_PURPOSE:
        raise expired
    users = UserRepository(db)
    account = await users.get_by_id(int(payload["sub"]))
    if account is None or account.password_hash is None or payload.get("fp") != _fingerprint(account.password_hash):
        raise expired
    check_password(new)
    await users.set_password_hash(account.id, hash_password(new))
    await db.commit()
