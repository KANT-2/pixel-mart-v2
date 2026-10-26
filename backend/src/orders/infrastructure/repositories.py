from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cart import CartItem
from app.models.order import Order as OrderModel
from app.models.order import OrderItem as OrderItemModel
from app.models.order import OrderStatusHistory
from app.models.product import Product
from app.models.user import User
from app.services import notifications
from src.orders.domain.exceptions import EmptyCart, OutOfStock
from src.orders.domain.order import Order, OrderItem


class OrderRepository:
    """기존 주문 ORM과 새 주문 도메인을 연결한다. commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def from_cart(self, user_id: int) -> Order:
        # 동일 사용자의 동시 주문을 직렬화한다.
        # 이 행 잠금은 서비스의 commit 또는 rollback까지 유지된다.
        # 먼저 완료된 주문이 장바구니를 비우면
        # 다음 요청은 EmptyCart로 중복 주문을 방지한다.
        await self.session.scalar(
            select(User.id)
            .where(User.id == user_id)
            .with_for_update()
        )

        rows = (
            await self.session.scalars(
                select(CartItem)
                .where(CartItem.user_id == user_id)
                .order_by(CartItem.added_at, CartItem.product_id)
            )
        ).all()

        if not rows:
            raise EmptyCart()

        return Order(
            tuple(
                OrderItem(
                    row.product_id,
                    row.quantity,
                    row.product.price,
                )
                for row in rows
            )
        )

    async def take_stock(self, item: OrderItem) -> None:
        # 조건부 UPDATE 한 번으로 동시에 주문해도 재고가 음수가 되지 않게 한다.
        result = await self.session.execute(
            update(Product)
            .where(
                Product.id == item.product_id,
                Product.stock >= item.quantity,
            )
            .values(stock=Product.stock - item.quantity)
        )

        if result.rowcount == 1:
            return

        remaining = await self.session.scalar(
            select(Product.stock).where(
                Product.id == item.product_id
            )
        )

        raise OutOfStock(remaining or 0)

    async def add(
        self,
        user_id: int,
        recipient_name: str,
        address: str,
        order: Order,
    ) -> int:
        before = await notifications.snapshot(
            self.session,
            user_id,
        )

        record = OrderModel(
            user_id=user_id,
            status="paid",
            shipping_fee=order.shipping_fee,
            total_price=order.total_price,
            recipient_name=recipient_name,
            address=address,
            items=[
                OrderItemModel(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                )
                for item in order.items
            ],
            history=[
                OrderStatusHistory(status="paid")
            ],
        )

        self.session.add(record)
        await self.session.flush()

        await notifications.notify(
            self.session,
            user_id,
            "order_placed",
            "주문이 완료됐어요",
            f"주문번호 {record.id} · 상품 {sum(item.quantity for item in order.items)}개",
            f"/mypage/orders/{record.id}",
            f"order:{record.id}",
        )

        await notifications.notify_progress(
            self.session,
            user_id,
            before,
        )

        return record.id

    async def clear_cart(self, user_id: int) -> None:
        await self.session.execute(
            delete(CartItem).where(
                CartItem.user_id == user_id
            )
        )

    async def get_for_user(
        self,
        user_id: int,
        order_id: int,
    ) -> OrderModel | None:
        return await self.session.scalar(
            select(OrderModel)
            .where(
                OrderModel.id == order_id,
                OrderModel.user_id == user_id,
            )
            .execution_options(populate_existing=True)
        )

    async def list_for_user(
        self,
        user_id: int,
        status: str | None,
        query: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[OrderModel], int]:
        filters = [OrderModel.user_id == user_id]

        if status is not None:
            filters.append(OrderModel.status == status)

        if query:
            escaped = (
                query.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )

            product_match = (
                select(OrderItemModel.id)
                .join(
                    Product,
                    Product.id == OrderItemModel.product_id,
                )
                .where(
                    OrderItemModel.order_id == OrderModel.id,
                    Product.name.ilike(
                        f"%{escaped}%",
                        escape="\\",
                    ),
                )
                .exists()
            )

            order_number = query.removeprefix("#")

            filters.append(
                or_(
                    OrderModel.id == int(order_number),
                    product_match,
                )
                if order_number.isdecimal()
                else product_match
            )

        total = (
            await self.session.scalar(
                select(func.count())
                .select_from(OrderModel)
                .where(*filters)
            )
            or 0
        )

        rows = list(
            await self.session.scalars(
                select(OrderModel)
                .where(*filters)
                .order_by(
                    OrderModel.created_at.desc(),
                    OrderModel.id.desc(),
                )
                .offset(offset)
                .limit(limit)
            )
        )

        return rows, total
