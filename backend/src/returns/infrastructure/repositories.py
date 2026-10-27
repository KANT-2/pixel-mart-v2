from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderStatusHistory
from app.models.user import User
from app.services import notifications
from src.admin_orders.infrastructure.repositories import AdminOrderRepository
from src.points.infrastructure.models import PointTransaction
from src.returns.infrastructure.models import ReturnRequest


@dataclass
class ReturnRequestRow:
    """관리자 목록 한 줄 — 신청 + 주문 + 주문자 닉네임"""

    id: int
    order_id: int
    kind: str
    reason: str
    status: str
    created_at: datetime
    order_status: str
    buyer_nickname: str
    total_price: int


class ReturnRepository:
    """구매 확정 · 반품/교환. commit은 서비스가 한다"""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        # 재고 복구·적립금/쿠폰 되돌리기는 취소 처리와 같은 코드를 쓴다
        self.orders = AdminOrderRepository(session)

    async def get_user_order_for_update(self, user_id: int, order_id: int) -> Order | None:
        return await self.session.scalar(
            select(Order).where(Order.id == order_id, Order.user_id == user_id).with_for_update()
        )

    async def get_order_for_update(self, order_id: int) -> Order | None:
        return await self.orders.get_order_for_update(order_id)

    async def set_status(self, order: Order, status: str) -> None:
        order.status = status
        self.session.add(OrderStatusHistory(order_id=order.id, status=status))

    def add_request(self, order_id: int, kind: str, reason: str) -> None:
        self.session.add(ReturnRequest(order_id=order_id, kind=kind, reason=reason))

    def reward(self, user_id: int, order_id: int, amount: int) -> None:
        if amount > 0:
            self.session.add(
                PointTransaction(user_id=user_id, order_id=order_id, kind="purchase_reward", amount=amount)
            )

    async def get_request_for_update(self, request_id: int) -> ReturnRequest | None:
        return await self.session.scalar(select(ReturnRequest).where(ReturnRequest.id == request_id).with_for_update())

    async def restore_stock_and_benefits(self, order: Order) -> None:
        for item in order.items:
            await self.orders.restore_item_stock(item.product_id, item.quantity)
        await self.orders.refund_points(order)

    async def notify(self, user_id: int, kind: str, title: str, body: str, href: str, ref_key: str) -> None:
        await notifications.notify(self.session, user_id, kind, title, body, href, ref_key)

    async def list_requests(self, status: str | None, offset: int, limit: int) -> tuple[list[ReturnRequestRow], int]:
        filters = [ReturnRequest.status == status] if status is not None else []
        total = await self.session.scalar(select(func.count()).select_from(ReturnRequest).where(*filters)) or 0
        rows = (
            await self.session.execute(
                select(
                    ReturnRequest.id,
                    ReturnRequest.order_id,
                    ReturnRequest.kind,
                    ReturnRequest.reason,
                    ReturnRequest.status,
                    ReturnRequest.created_at,
                    Order.status,
                    User.nickname,
                    Order.total_price,
                )
                .join(Order, Order.id == ReturnRequest.order_id)
                .join(User, User.id == Order.user_id)
                .where(*filters)
                .order_by(ReturnRequest.created_at.desc(), ReturnRequest.id.desc())
                .offset(offset)
                .limit(limit)
            )
        ).all()
        return [ReturnRequestRow(*row) for row in rows], total
