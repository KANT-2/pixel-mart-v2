from typing import Protocol, TypeVar

from src.orders.domain.order import Order, OrderItem
from src.points.domain.rules import validate_point_use

OrderRecord = TypeVar("OrderRecord")


class Orders(Protocol[OrderRecord]):
    async def from_cart(self, user_id: int) -> Order: ...
    async def has_previous_order(self, user_id: int) -> bool: ...
    async def take_stock(self, item: OrderItem) -> None: ...
    async def add(self, user_id: int, recipient_name: str, address: str, order: Order, points_used: int) -> int: ...
    async def clear_cart(self, user_id: int) -> None: ...
    async def get_for_user(self, user_id: int, order_id: int) -> OrderRecord | None: ...
    async def list_for_user(
        self, user_id: int, status: str | None, query: str | None, offset: int, limit: int
    ) -> tuple[list[OrderRecord], int]: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class Points(Protocol):
    async def balance(self, user_id: int) -> int: ...
    def record_first_purchase(self, user_id: int, order_id: int) -> None: ...
    def record_spend(self, user_id: int, order_id: int, amount: int) -> None: ...


class OrderService[OrderRecord]:
    def __init__(self, orders: Orders[OrderRecord], tx: Transaction, points: Points) -> None:
        self.orders = orders
        self.tx = tx
        self.points = points

    async def place_order(self, user_id: int, recipient_name: str, address: str, points_used: int = 0) -> int:
        """장바구니 조회부터 비우기까지 모두 성공해야 주문을 확정한다."""
        try:
            order = await self.orders.from_cart(user_id)
            validate_point_use(points_used, await self.points.balance(user_id), order.total_price)
            first_purchase = not await self.orders.has_previous_order(user_id)
            for item in order.items:
                await self.orders.take_stock(item)
            order_id = await self.orders.add(user_id, recipient_name, address, order, points_used)
            if first_purchase:
                self.points.record_first_purchase(user_id, order_id)
            self.points.record_spend(user_id, order_id, points_used)
            await self.orders.clear_cart(user_id)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return order_id

    async def get_order(self, user_id: int, order_id: int) -> OrderRecord | None:
        return await self.orders.get_for_user(user_id, order_id)

    async def list_orders(
        self,
        user_id: int,
        status: str | None,
        query: str | None,
        page: int,
        size: int,
    ) -> tuple[list[OrderRecord], int]:
        return await self.orders.list_for_user(user_id, status, query, (page - 1) * size, size)
