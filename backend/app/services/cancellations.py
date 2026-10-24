from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CancelRequest, Order, OrderStatusHistory, User
from app.services import notifications  # 승인·거절 알림을 구매자에게 보내기 위해
from app.services.orders import get_order

# 배송이 시작되기 전에만 취소를 신청할 수 있다
CANCELLABLE = ("paid", "preparing")
CANCEL_FLOW = ("cancel_requested", "cancelled")


class CannotCancelError(Exception):
    """배송이 시작되어 취소를 신청할 수 없음"""


class AlreadyCancelRequestedError(Exception):
    """이미 취소를 신청했거나 취소가 끝난 주문"""


class NotPendingError(Exception):
    """이미 처리된(승인·거절된) 취소 신청"""


def check_cancellable(status: str) -> None:
    """취소 신청이 가능한 상태인지 검사. DB 없이 테스트할 수 있는 순수 함수"""
    if status in CANCEL_FLOW:
        raise AlreadyCancelRequestedError(status)
    if status not in CANCELLABLE:
        raise CannotCancelError(status)


def status_before_cancel(history: Sequence[str]) -> str:
    """취소 신청 직전의 상태 — 거절되면 이 상태로 돌아간다 (타임라인에서 찾는다)"""
    for status in reversed(history):
        if status not in CANCEL_FLOW:
            return status
    raise ValueError("취소 신청 이전의 상태 기록이 없습니다.")


async def request_cancel(db: AsyncSession, order: Order, reason: str) -> CancelRequest:
    """신청서 저장 + 주문 상태 변경 + 타임라인 기록을 한 번의 commit으로 처리"""
    check_cancellable(order.status)
    request = CancelRequest(order_id=order.id, reason=reason)
    order.status = "cancel_requested"
    db.add(request)
    db.add(OrderStatusHistory(order_id=order.id, status="cancel_requested"))
    await db.commit()
    return await _load_request(db, request.id)


async def get_user_cancel_request(db: AsyncSession, user: User, request_id: int) -> CancelRequest | None:
    """내 주문의 신청서만 돌려준다. 남의 것은 없는 것처럼(None) 숨긴다"""
    return await db.scalar(
        select(CancelRequest)
        .join(Order, Order.id == CancelRequest.order_id)
        .where(CancelRequest.id == request_id, Order.user_id == user.id)
        .execution_options(populate_existing=True)
    )


async def resolve_cancel(db: AsyncSession, request: CancelRequest, *, approve: bool) -> CancelRequest:
    """승인 → 주문 취소 완료 / 거절 → 신청 직전 상태로 복귀. 신청서·주문·타임라인을 한 번에 갱신"""
    if request.status != "requested":
        raise NotPendingError(request.status)

    order = await get_order(db, request.order_id)
    if approve:
        request.status = "approved"  # 신청서 상태를 승인으로 바꾼다
        new_status = "cancelled"  # 주문은 취소 완료 상태가 된다
        title, body = "주문이 취소됐어요", f"주문번호 {order.id} · 결제가 취소됐어요."  # 구매자에게 보여줄 문구
    else:
        request.status = "rejected"  # 신청서 상태를 거절로 바꾼다
        new_status = status_before_cancel([h.status for h in order.history])  # 신청 직전 상태로 복귀
        title, body = "취소 요청이 거절됐어요", f"주문번호 {order.id} · 주문이 계속 진행돼요."  # 구매자에게 보여줄 문구
    order.status = new_status
    db.add(OrderStatusHistory(order_id=order.id, status=new_status))
    await notifications.notify(
        db,
        order.user_id,  # 알림 대상은 신청자가 아니라 주문 주인(구매자)
        f"cancel_{request.status}",  # cancel_approved / cancel_rejected
        title,
        body,
        f"/mypage/orders/{order.id}",  # 주문 상세로 이동
        f"cancel:{request.id}:{request.status}",  # 신청 번호 + 상태로 중복 알림 방지
    )
    await db.commit()
    return await _load_request(db, request.id)


async def _load_request(db: AsyncSession, request_id: int) -> CancelRequest:
    # id·created_at 같은 DB가 채운 값을 읽어 온다
    return await db.scalar(
        select(CancelRequest).where(CancelRequest.id == request_id).execution_options(populate_existing=True)
    )
