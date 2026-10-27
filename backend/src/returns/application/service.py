# 배송 완료 뒤 — 구매 확정, 반품·교환 신청, 관리자 승인/거절을 한 트랜잭션으로 묶는다
from datetime import UTC, datetime

from src.admin_orders.domain.exceptions import OrderNotFound
from src.returns.domain.rules import (
    REQUESTED_STATUS,
    ReturnRequestNotFound,
    check_confirmable,
    check_pending,
    check_returnable,
    purchase_reward,
    resolved_status,
)
from src.returns.infrastructure.repositories import ReturnRepository

KIND_LABELS = {"return": "반품", "exchange": "교환"}


class ReturnService:
    def __init__(self, repo: ReturnRepository, tx) -> None:
        self.repo = repo
        self.tx = tx

    async def confirm(self, user_id: int, order_id: int) -> int:
        """구매 확정 — 결제 금액의 1%를 적립하고, 이후에는 반품·교환을 받지 않는다. 적립액을 돌려준다"""
        try:
            order = await self.repo.get_user_order_for_update(user_id, order_id)
            if order is None:
                raise OrderNotFound()
            check_confirmable(order.status, order.confirmed_at)
            order.confirmed_at = datetime.now(UTC)
            reward = purchase_reward(order.total_price)
            self.repo.reward(user_id, order.id, reward)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return reward

    async def request(self, user_id: int, order_id: int, kind: str, reason: str) -> None:
        try:
            order = await self.repo.get_user_order_for_update(user_id, order_id)
            if order is None:
                raise OrderNotFound()
            check_returnable(order.status, order.confirmed_at)
            self.repo.add_request(order.id, kind, reason)
            await self.repo.set_status(order, REQUESTED_STATUS[kind])
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise

    async def resolve(self, request_id: int, *, approve: bool) -> None:
        """승인: 반품은 재고·적립금·쿠폰 되돌리기 / 교환은 재배송 준비(운송장 초기화). 거절: 배송 완료로"""
        try:
            request = await self.repo.get_request_for_update(request_id)
            if request is None:
                raise ReturnRequestNotFound()
            check_pending(request.status)
            order = await self.repo.get_order_for_update(request.order_id)
            if order is None:
                raise OrderNotFound()
            request.status = "approved" if approve else "rejected"
            request.resolved_at = datetime.now(UTC)
            new_status = resolved_status(request.kind, approve)
            await self.repo.set_status(order, new_status)
            label = KIND_LABELS[request.kind]
            if approve and request.kind == "return":
                await self.repo.restore_stock_and_benefits(order)
                body = f"주문번호 {order.id} · 결제가 환불됐어요."
            elif approve:
                order.courier, order.tracking_number = None, None
                body = f"주문번호 {order.id} · 새 상품을 준비해서 다시 보내 드려요."
            else:
                body = f"주문번호 {order.id} · 배송 완료 상태로 돌아갔어요."
            await self.repo.notify(
                order.user_id,
                f"return_{request.status}",
                f"{label} 신청이 {'승인' if approve else '거절'}됐어요",
                body,
                f"/mypage/orders/{order.id}",
                f"return:{request.id}:{request.status}",
            )
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise

    async def list_requests(self, status: str | None, page: int, size: int):
        return await self.repo.list_requests(status, (page - 1) * size, size)
