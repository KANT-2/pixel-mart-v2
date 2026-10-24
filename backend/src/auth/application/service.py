from datetime import UTC, datetime
from typing import Protocol

from src.auth.domain.account import Account, check_password, normalize_email
from src.auth.domain.exceptions import EmailTaken, InvalidEmail, LoginFailed, NicknameTaken
from src.auth.domain.token import IssuedToken
from src.auth.infrastructure.hasher import hash_password, verify_password
from src.auth.infrastructure.jwt import issue_token


# 서비스가 기대하는 모양만 적어 둔다 — 테스트에서는 DB 없는 가짜 저장소로 바꿔 끼울 수 있다
class Users(Protocol):
    async def get_by_email(self, email: str) -> Account | None: ...
    async def email_exists(self, email: str) -> bool: ...
    async def nickname_exists(self, nickname: str) -> bool: ...
    async def add(self, account: Account) -> Account: ...


class Blacklist(Protocol):
    async def add(self, jti: str, expires_at: datetime) -> None: ...
    async def contains(self, jti: str) -> bool: ...
    async def delete_expired(self, now: datetime) -> int: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class AuthService:
    def __init__(self, users: Users, blacklist: Blacklist, tx: Transaction) -> None:
        self.users = users
        self.blacklist = blacklist
        self.tx = tx

    async def signup(self, email: str, password: str, nickname: str) -> Account:
        check_password(password)
        draft = Account(id=None, email=email, nickname=nickname)  # 이메일·닉네임 형식 검사
        if await self.users.email_exists(draft.email):
            raise EmailTaken()
        if await self.users.nickname_exists(draft.nickname):
            raise NicknameTaken()
        try:
            account = await self.users.add(
                Account(id=None, email=draft.email, nickname=draft.nickname, password_hash=hash_password(password))
            )
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return account

    async def login(self, email: str, password: str) -> tuple[str, IssuedToken]:
        try:
            normalized = normalize_email(email)
        except InvalidEmail:
            raise LoginFailed() from None  # 형식이 틀려도 같은 문구
        account = await self.users.get_by_email(normalized)
        # 없는 이메일 · 구글 가입자(해시 없음) · 틀린 비밀번호를 구분하지 않는다
        if account is None or account.password_hash is None or not verify_password(password, account.password_hash):
            raise LoginFailed()
        return issue_token(account.id)

    async def logout(self, token: IssuedToken) -> None:
        try:
            await self.blacklist.add(token.jti, token.expires_at)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise

    async def is_revoked(self, jti: str) -> bool:
        return await self.blacklist.contains(jti)

    async def purge_expired_blacklist(self, now: datetime | None = None) -> int:
        """이미 만료된 토큰의 블랙리스트 줄을 지우고 지운 개수를 돌려준다 (만료 전 줄은 그대로)"""
        try:
            removed = await self.blacklist.delete_expired(now or datetime.now(UTC))
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return removed
