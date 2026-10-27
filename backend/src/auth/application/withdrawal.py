from datetime import datetime
from typing import Protocol

from src.auth.domain.exceptions import MemberNotFound
from src.auth.domain.token import IssuedToken
from src.auth.domain.withdrawal import WithdrawTarget, check_can_withdraw


class WithdrawStore(Protocol):
    async def target(self, user_id: int) -> WithdrawTarget | None: ...
    async def anonymize(self, user_id: int, now: datetime) -> None: ...
    async def clean_up(self, user_id: int) -> None: ...


class Blacklist(Protocol):
    async def add(self, jti: str, expires_at: datetime) -> None: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class WithdrawService:
    """회원 탈퇴: 막을 조건 확인 → 개인 데이터 정리 · 익명화 → 지금 토큰 무효화를 한 트랜잭션으로."""

    def __init__(self, store: WithdrawStore, blacklist: Blacklist, tx: Transaction) -> None:
        self.store = store
        self.blacklist = blacklist
        self.tx = tx

    async def withdraw(self, user_id: int, token: IssuedToken | None, now: datetime) -> None:
        target = await self.store.target(user_id)
        if target is None:
            raise MemberNotFound()
        check_can_withdraw(target)
        try:
            await self.store.clean_up(user_id)
            await self.store.anonymize(user_id, now)
            if token is not None:
                await self.blacklist.add(token.jti, token.expires_at)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
