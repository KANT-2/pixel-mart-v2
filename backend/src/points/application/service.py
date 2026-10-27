from typing import Protocol

from src.points.domain.entry import PointEntry


class Points(Protocol):
    async def balance(self, user_id: int) -> int: ...
    async def history(self, user_id: int, offset: int, limit: int) -> tuple[list[PointEntry], int]: ...


class PointService:
    def __init__(self, points: Points) -> None:
        self.points = points

    async def balance(self, user_id: int) -> int:
        return await self.points.balance(user_id)

    async def history(self, user_id: int, page: int, size: int) -> tuple[list[PointEntry], int]:
        return await self.points.history(user_id, (page - 1) * size, size)
