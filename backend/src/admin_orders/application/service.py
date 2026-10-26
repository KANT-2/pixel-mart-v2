# 관리자 주문 서비스 — 배송 단계 넘기기, 취소 요청 승인/거절을 한 트랜잭션으로 묶는다.
from typing import Protocol

from src.admin_orders.domain.cancel import CancelRequest, status_before_cancel
from src.admin_orders.domain.exceptions import CancelRequestNotFound, OrderNotFound
from src.admin_orders.domain.progress import OrderProgress
from src.orders.domain.order import STATUS_LABELS  # 알림 문구에 쓸 한글 라벨 — 읽기만 한다(수정 금지 파일)


# 저장소가 갖춰야 할 모양 — 실제 구현은 infrastructure/repositories.py의 AdminOrderRepository
class AdminOrders(Protocol):
    async def get_order_for_update(self, order_id: int): ...
    async def add_order_history(self, order, status: str) -> None: ...
    async def get_cancel_request_for_update(self, request_id: int): ...
    async def restore_item_stock(self, product_id: int, quantity: int) -> None: ...
    async def notify_buyer(self, user_id: int, kind: str, title: str, body: str, href: str, ref_key: str) -> None: ...
    async def list_orders(self, status: str | None, q: str | None, offset: int, limit: int): ...
    async def get_order_detail(self, order_id: int): ...


# 트랜잭션이 갖춰야 할 모양 — 실제로는 AsyncSession 자체가 들어온다
class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class AdminOrderService:
    def __init__(self, orders: AdminOrders, tx: Transaction) -> None:
        self.orders = orders
        self.tx = tx

    async def advance_order(self, order_id: int) -> str:
        """배송 단계를 한 칸 넘기고, 타임라인·알림까지 성공해야 커밋한다."""
        try:
            order = await self.orders.get_order_for_update(order_id)
            if order is None:
                raise OrderNotFound()
            new_status = OrderProgress(order.status).advance()  # 더 못 넘기면 InvalidTransition
            await self.orders.add_order_history(order, new_status)
            await self.orders.notify_buyer(
                order.user_id,
                f"order_{new_status}",
                "배송 상태가 바뀌었어요",
                f"주문번호 {order.id} · {STATUS_LABELS[new_status]}",
                f"/mypage/orders/{order.id}",
                f"order:{order.id}:{new_status}",
            )
            await self.tx.commit()
        except Exception:
            # 중간 어디서든 실패하면 상태·타임라인·알림이 전부 없었던 일이 된다
            await self.tx.rollback()
            raise
        return new_status

    async def approve_cancel(self, request_id: int) -> None:
        """취소 요청을 승인 — 주문 취소 완료 + 재고 복구 + 알림까지 성공해야 커밋한다."""
        try:
            request = await self.orders.get_cancel_request_for_update(request_id)
            if request is None:
                raise CancelRequestNotFound()
            request.status = CancelRequest(request.status).approve()  # 이미 처리됐으면 AlreadyResolved
            order = await self.orders.get_order_for_update(request.order_id)
            if order is None:
                raise OrderNotFound()
            await self.orders.add_order_history(order, "cancelled")
            for item in order.items:
                await self.orders.restore_item_stock(item.product_id, item.quantity)
            await self.orders.notify_buyer(
                order.user_id,
                "cancel_approved",
                "주문이 취소됐어요",
                f"주문번호 {order.id} · 결제가 취소됐어요.",
                f"/mypage/orders/{order.id}",
                f"cancel:{request.id}:approved",
            )
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise

    async def list_orders(self, status: str | None, q: str | None, page: int, size: int):
        """주문 목록 — 조회만 하므로 커밋/롤백이 필요 없어 저장소에 그대로 위임한다."""
        return await self.orders.list_orders(status, q, (page - 1) * size, size)

    async def get_order(self, order_id: int):
        """주문 상세 — 없으면 OrderNotFound(404)."""
        row = await self.orders.get_order_detail(order_id)
        if row is None:
            raise OrderNotFound()
        return row

    async def reject_cancel(self, request_id: int) -> None:
        """취소 요청을 거절 — 주문을 신청 직전 상태로 되돌리고 알림까지 성공해야 커밋한다. 재고는 건드리지 않는다."""
        try:
            request = await self.orders.get_cancel_request_for_update(request_id)
            if request is None:
                raise CancelRequestNotFound()
            request.status = CancelRequest(request.status).reject()  # 이미 처리됐으면 AlreadyResolved
            order = await self.orders.get_order_for_update(request.order_id)
            if order is None:
                raise OrderNotFound()
            previous_status = status_before_cancel([entry.status for entry in order.history])
            await self.orders.add_order_history(order, previous_status)
            await self.orders.notify_buyer(
                order.user_id,
                "cancel_rejected",
                "취소 요청이 거절됐어요",
                f"주문번호 {order.id} · 주문이 계속 진행돼요.",
                f"/mypage/orders/{order.id}",
                f"cancel:{request.id}:rejected",
            )
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
