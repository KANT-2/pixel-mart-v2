from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cart import CartItem
from app.models.order import Order as OrderModel
from app.models.order import OrderItem as OrderItemModel
from app.models.order import OrderStatusHistory
from app.models.product import Product
from src.orders.domain.exceptions import EmptyCart, OutOfStock
from src.orders.domain.order import Order, OrderItem


class OrderRepository:
    """기존 주문 ORM과 새 주문 도메인을 연결한다. commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def from_cart(self, user_id: int) -> Order:
        rows = (
            await self.session.scalars(
                select(CartItem).where(CartItem.user_id == user_id).order_by(CartItem.added_at, CartItem.product_id)
            )
        ).all()
        if not rows:
            raise EmptyCart()
        return Order(tuple(OrderItem(row.product_id, row.quantity, row.product.price) for row in rows))

    async def take_stock(self, item: OrderItem) -> None:
        # 조건부 UPDATE 한 번으로 동시에 주문해도 재고가 음수가 되지 않게 한다.
        result = await self.session.execute(
            update(Product)
            .where(Product.id == item.product_id, Product.stock >= item.quantity)
            .values(stock=Product.stock - item.quantity)
        )
        if result.rowcount == 1:
            return
        remaining = await self.session.scalar(select(Product.stock).where(Product.id == item.product_id))
        raise OutOfStock(remaining or 0)

    async def add(self, user_id: int, recipient_name: str, address: str, order: Order) -> int:
        record = OrderModel(
            user_id=user_id,
            status="paid",
            shipping_fee=order.shipping_fee,
            total_price=order.total_price,
            recipient_name=recipient_name,
            address=address,
            items=[
                OrderItemModel(product_id=item.product_id, quantity=item.quantity, unit_price=item.unit_price)
                for item in order.items
            ],
            history=[OrderStatusHistory(status="paid")],
        )
        self.session.add(record)
        await self.session.flush()
        return record.id

    async def clear_cart(self, user_id: int) -> None:
        await self.session.execute(delete(CartItem).where(CartItem.user_id == user_id))
