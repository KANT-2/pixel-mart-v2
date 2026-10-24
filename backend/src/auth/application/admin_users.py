from typing import Protocol

from src.auth.domain.member import MemberSummary


class MemberSearch(Protocol):
    async def search(
        self, q: str | None, role: str | None, offset: int, limit: int
    ) -> tuple[list[MemberSummary], int]: ...


class AdminUserService:
    def __init__(self, members: MemberSearch) -> None:
        self.members = members

    async def list_members(
        self, q: str | None, role: str | None, page: int, size: int
    ) -> tuple[list[MemberSummary], int]:
        keyword = q.strip() if q else None  # 공백만 친 검색어는 검색 안 함
        return await self.members.search(keyword or None, role, (page - 1) * size, size)
