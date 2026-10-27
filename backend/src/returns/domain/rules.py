# 배송 완료 뒤 — 구매 확정 · 반품/교환 신청과 처리 규칙 (DB 없이 테스트하는 순수 함수)
from datetime import datetime

PURCHASE_REWARD_RATE = 1  # 구매 확정 시 결제 금액의 1% 적립
REQUESTED_STATUS = {"return": "return_requested", "exchange": "exchange_requested"}


class AfterDeliveryError(Exception):
    """지금 주문 상태에서는 구매 확정·반품·교환을 할 수 없음"""


class ReturnRequestNotFound(Exception):
    def __init__(self, message: str = "반품·교환 신청을 찾을 수 없어요.") -> None:
        super().__init__(message)


def check_confirmable(status: str, confirmed_at: datetime | None) -> None:
    if confirmed_at is not None:
        raise AfterDeliveryError("이미 구매를 확정한 주문이에요.")
    if status != "delivered":
        raise AfterDeliveryError("배송 완료된 주문만 구매 확정할 수 있어요.")


def check_returnable(status: str, confirmed_at: datetime | None) -> None:
    if confirmed_at is not None:
        raise AfterDeliveryError("구매 확정한 주문은 반품·교환할 수 없어요.")
    if status in REQUESTED_STATUS.values():
        raise AfterDeliveryError("이미 반품·교환을 신청한 주문이에요.")
    if status != "delivered":
        raise AfterDeliveryError("배송 완료된 주문만 반품·교환을 신청할 수 있어요.")


def purchase_reward(total_price: int) -> int:
    return total_price * PURCHASE_REWARD_RATE // 100


def resolved_status(kind: str, approve: bool) -> str:
    """처리 뒤 주문 상태 — 반품 승인은 반품 완료, 교환 승인은 다시 상품 준비중(재배송), 거절은 배송 완료로"""
    if not approve:
        return "delivered"
    return "returned" if kind == "return" else "preparing"


def check_pending(status: str) -> None:
    if status != "requested":
        raise AfterDeliveryError("이미 처리된 신청이에요.")
