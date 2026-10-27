from typing import Protocol

from src.auth.domain.exceptions import MemberNotFound
from src.auth.domain.member import MemberSummary, avatar_reset_key


class MemberSearch(Protocol):
    async def search(
        self, q: str | None, role: str | None, offset: int, limit: int
    ) -> tuple[list[MemberSummary], int]: ...


class MemberAvatars(Protocol):
    async def get(self, user_id: int) -> MemberSummary | None: ...
    async def clear_avatar(self, user_id: int) -> MemberSummary: ...
    async def notify_avatar_reset(self, user_id: int, ref_key: str, memo: str | None) -> None: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class AdminUserService:
    def __init__(self, members: MemberSearch) -> None:
        self.members = members

    async def list_members(
        self, q: str | None, role: str | None, page: int, size: int
    ) -> tuple[list[MemberSummary], int]:
        keyword = q.strip() if q else None  # 공백만 친 검색어는 검색 안 함
        return await self.members.search(keyword or None, role, (page - 1) * size, size)


class AvatarResetService:
    """관리자가 수위를 넘는 픽셀 아바타를 기본 모습으로 되돌린다."""

    def __init__(self, members: MemberAvatars, tx: Transaction) -> None:
        self.members = members
        self.tx = tx

    async def reset(self, user_id: int, memo: str | None = None) -> MemberSummary:
        member = await self.members.get(user_id)
        if member is None:
            raise MemberNotFound()
        if member.avatar_url is None:
            return member  # 이미 기본 모습이면 바꿀 것도, 알릴 것도 없음
        try:
            updated = await self.members.clear_avatar(user_id)
            await self.members.notify_avatar_reset(user_id, avatar_reset_key(member.avatar_url), memo)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return updated
