# 관리자 주문 레포지토리 — ORM(app.models.*)과 admin_orders 도메인을 연결한다. commit은 서비스가 한다.
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cancel_request import CancelRequest as CancelRequestModel
from app.models.order import Order, OrderStatusHistory
from app.models.product import Product
from app.services import notifications  # 구매자 알림은 기존 알림 서비스를 그대로 쓴다
from src.orders.domain.stock import StockItem  # 재고 복구 규칙(성용님 파일) — 호출만 하고 고치지 않는다


class AdminOrderRepository:
    """관리자 주문·취소 처리에 쓰는 저장소. commit은 하지 않는다(서비스가 한다)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_order_for_update(self, order_id: int) -> Order | None:
        # 같은 주문을 동시에 처리하지 못하게 행을 잠근 채로 가져온다
        return await self.session.scalar(select(Order).where(Order.id == order_id).with_for_update())

    async def add_order_history(self, order: Order, status: str) -> None:
        # 주문 상태를 바꾸고, 타임라인에 한 줄을 남긴다
        order.status = status
        self.session.add(OrderStatusHistory(order_id=order.id, status=status))

    async def get_cancel_request_for_update(self, request_id: int) -> CancelRequestModel | None:
        # 같은 취소 요청을 동시에 두 번 처리하지 못하게 행을 잠근 채로 가져온다
        return await self.session.scalar(
            select(CancelRequestModel).where(CancelRequestModel.id == request_id).with_for_update()
        )

    async def restore_item_stock(self, product_id: int, quantity: int) -> None:
        # 지금 재고를 잠근 채로 읽어 StockItem을 만들고 restore()로 되돌린 뒤 그 결과를 저장한다
        stock = await self.session.scalar(select(Product.stock).where(Product.id == product_id).with_for_update())
        item = StockItem(product_id, stock)
        item.restore(quantity)
        await self.session.execute(update(Product).where(Product.id == product_id).values(stock=item.stock))

    async def notify_buyer(self, user_id: int, kind: str, title: str, body: str, href: str, ref_key: str) -> None:
        # 주문 주인(구매자)에게 보내는 알림 — 기존 notifications.notify를 그대로 호출한다
        await notifications.notify(self.session, user_id, kind, title, body, href, ref_key)
