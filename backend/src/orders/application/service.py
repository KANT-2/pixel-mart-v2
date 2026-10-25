from typing import Protocol

from src.orders.domain.order import Order, OrderItem


class Orders(Protocol):
    async def from_cart(self, user_id: int) -> Order: ...
    async def take_stock(self, item: OrderItem) -> None: ...
    async def add(self, user_id: int, recipient_name: str, address: str, order: Order) -> int: ...
    async def clear_cart(self, user_id: int) -> None: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class OrderService:
    def __init__(self, orders: Orders, tx: Transaction) -> None:
        self.orders = orders
        self.tx = tx

    async def place_order(self, user_id: int, recipient_name: str, address: str) -> int:
        """장바구니 조회부터 비우기까지 모두 성공해야 주문을 확정한다."""
        try:
            order = await self.orders.from_cart(user_id)
            for item in order.items:
                await self.orders.take_stock(item)
            order_id = await self.orders.add(user_id, recipient_name, address, order)
            await self.orders.clear_cart(user_id)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return order_id
