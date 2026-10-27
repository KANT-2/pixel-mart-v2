# 관리자 주문 레포지토리 — ORM(app.models.*)과 admin_orders 도메인을 연결한다. commit은 서비스가 한다.
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cancel_request import CancelRequest as CancelRequestModel
from app.models.order import Order, OrderStatusHistory
from app.models.product import Product
from app.models.user import User
from app.services import notifications  # 구매자 알림은 기존 알림 서비스를 그대로 쓴다
from src.coupons.infrastructure.repositories import CouponRepository
from src.orders.domain.stock import StockItem  # 재고 복구 규칙(성용님 파일) — 호출만 하고 고치지 않는다
from src.points.infrastructure.repositories import PointRepository


@dataclass
class AdminOrderRow:
    """주문 목록·상세 한 줄 — Order·User를 join한 결과를 담는 순수 데이터 그릇"""

    order: Order
    buyer_nickname: str
    buyer_email: str


@dataclass
class CancelRequestListRow:
    """취소 요청 목록 한 줄 — CancelRequest·Order·User를 join한 결과를 담는 순수 데이터 그릇"""

    id: int
    order_id: int
    reason: str
    status: str
    created_at: datetime
    order_status: str
    buyer_nickname: str
    total_price: int


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

    async def refund_points(self, order: Order) -> None:
        PointRepository(self.session).refund_order(order.user_id, order.id, order.points_used)
        await CouponRepository(self.session).release_for_order(order.id)  # 쓴 쿠폰도 함께 돌려준다

    async def notify_buyer(self, user_id: int, kind: str, title: str, body: str, href: str, ref_key: str) -> None:
        # 주문 주인(구매자)에게 보내는 알림 — 기존 notifications.notify를 그대로 호출한다
        await notifications.notify(self.session, user_id, kind, title, body, href, ref_key)

    async def list_cancel_requests(
        self, status: str | None, offset: int, limit: int
    ) -> tuple[list[CancelRequestListRow], int]:
        # 읽기 전용 — 취소 요청 목록 화면용. CancelRequest엔 Order와의 관계가 없어서 직접 join한다
        filters = [CancelRequestModel.status == status] if status is not None else []

        total = await self.session.scalar(
            select(func.count()).select_from(CancelRequestModel).where(*filters)
        ) or 0

        rows = (
            await self.session.execute(
                select(
                    CancelRequestModel.id,
                    CancelRequestModel.order_id,
                    CancelRequestModel.reason,
                    CancelRequestModel.status,
                    CancelRequestModel.created_at,
                    Order.status,  # CancelRequestListRow.order_status
                    User.nickname,  # CancelRequestListRow.buyer_nickname
                    Order.total_price,  # CancelRequestListRow.total_price
                )
                .join(Order, Order.id == CancelRequestModel.order_id)
                .join(User, User.id == Order.user_id)
                .where(*filters)
                .order_by(CancelRequestModel.created_at.desc(), CancelRequestModel.id.desc())
                .offset(offset)
                .limit(limit)
            )
        ).all()

        return [CancelRequestListRow(*row) for row in rows], total

    def _order_row_query(self):
        # 목록·상세가 공통으로 쓰는 join — Order엔 User와의 관계가 없어서 직접 join한다
        return select(Order, User.nickname, User.email).join(User, User.id == Order.user_id)

    async def list_orders(
        self, status: str | None, q: str | None, offset: int, limit: int
    ) -> tuple[list[AdminOrderRow], int]:
        # 읽기 전용 — 주문 목록 화면용 (상태 필터, 주문번호·닉네임·이메일 검색, 페이지)
        filters = []
        if status is not None:
            filters.append(Order.status == status)
        if q:
            # %, _, \ 는 검색어 안에서 와일드카드로 쓰이지 않게 이스케이프한다
            escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            name_match = or_(
                User.nickname.ilike(f"%{escaped}%", escape="\\"),
                User.email.ilike(f"%{escaped}%", escape="\\"),
            )
            order_number = q.removeprefix("#")
            filters.append(or_(Order.id == int(order_number), name_match) if order_number.isdecimal() else name_match)

        total = (
            await self.session.scalar(
                select(func.count()).select_from(Order).join(User, User.id == Order.user_id).where(*filters)
            )
            or 0
        )

        rows = (
            await self.session.execute(
                self._order_row_query()
                .where(*filters)
                .order_by(Order.created_at.desc(), Order.id.desc())
                .offset(offset)
                .limit(limit)
            )
        ).all()

        # Order.items/history는 모델에서 lazy="selectin"이라, 이렇게 조회만 해도 N+1 없이 한 번씩 더 불러온다
        admin_rows = [
            AdminOrderRow(order=order, buyer_nickname=nickname, buyer_email=email) for order, nickname, email in rows
        ]
        return admin_rows, total

    async def get_order_detail(self, order_id: int) -> AdminOrderRow | None:
        # 읽기 전용 — 주문 상세 화면용 (잠그지 않는다, 그건 advance/승인/거절 쪽 메서드가 한다)
        row = await self.session.execute(self._order_row_query().where(Order.id == order_id))
        result = row.first()
        if result is None:
            return None
        order, nickname, email = result
        return AdminOrderRow(order=order, buyer_nickname=nickname, buyer_email=email)
