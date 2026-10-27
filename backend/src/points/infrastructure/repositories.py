from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.points.domain.entry import PointEntry
from src.points.domain.rules import FIRST_PURCHASE_BONUS
from src.points.infrastructure.models import PointTransaction


class PointRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def balance(self, user_id: int) -> int:
        return (
            await self.session.scalar(
                select(func.coalesce(func.sum(PointTransaction.amount), 0)).where(PointTransaction.user_id == user_id)
            )
            or 0
        )

    def record_first_purchase(self, user_id: int, order_id: int) -> None:
        self.session.add(
            PointTransaction(user_id=user_id, order_id=order_id, kind="first_purchase", amount=FIRST_PURCHASE_BONUS)
        )

    def record_spend(self, user_id: int, order_id: int, amount: int) -> None:
        if amount:
            self.session.add(PointTransaction(user_id=user_id, order_id=order_id, kind="order_spend", amount=-amount))

    def refund_order(self, user_id: int, order_id: int, amount: int) -> None:
        if amount:
            self.session.add(PointTransaction(user_id=user_id, order_id=order_id, kind="order_refund", amount=amount))

    async def history(self, user_id: int, offset: int, limit: int) -> tuple[list[PointEntry], int]:
        total = (
            await self.session.scalar(
                select(func.count(PointTransaction.id)).where(PointTransaction.user_id == user_id)
            )
            or 0
        )
        rows = await self.session.scalars(
            select(PointTransaction)
            .where(PointTransaction.user_id == user_id)
            .order_by(PointTransaction.created_at.desc(), PointTransaction.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return [PointEntry(row.id, row.order_id, row.kind, row.amount, row.created_at) for row in rows], total
