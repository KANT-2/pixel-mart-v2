# 관리자 주문 도메인(순수 파이썬) 테스트 — DB·FastAPI 없이 상태 전이 규칙만 확인한다
import pytest  # 예외 발생을 확인하는 pytest.raises를 쓴다

from src.admin_orders.domain.cancel import CancelRequest
from src.admin_orders.domain.exceptions import AlreadyResolved, InvalidTransition
from src.admin_orders.domain.progress import OrderProgress


def test_advance_moves_through_all_four_steps_in_order() -> None:
    # paid에서 시작해 delivered까지 한 칸씩 순서대로 넘어가는지 확인한다
    progress = OrderProgress("paid")
    assert progress.advance() == "preparing"
    assert progress.advance() == "shipping"
    assert progress.advance() == "delivered"


def test_advance_from_delivered_raises_invalid_transition() -> None:
    # 배송완료는 마지막 단계라 더 넘길 수 없다
    progress = OrderProgress("delivered")
    with pytest.raises(InvalidTransition):
        progress.advance()


def test_advance_from_cancel_requested_raises_invalid_transition() -> None:
    # 취소 요청 중인 주문은 배송 단계를 더 넘길 수 없다
    progress = OrderProgress("cancel_requested")
    with pytest.raises(InvalidTransition):
        progress.advance()


def test_advance_from_cancelled_raises_invalid_transition() -> None:
    # 이미 취소된 주문은 배송 단계를 더 넘길 수 없다
    progress = OrderProgress("cancelled")
    with pytest.raises(InvalidTransition):
        progress.advance()


def test_approve_twice_raises_already_resolved() -> None:
    # 한 번 승인한 요청을 또 승인하려 하면 안 된다
    cancel = CancelRequest("requested")
    assert cancel.approve() == "approved"
    with pytest.raises(AlreadyResolved):
        cancel.approve()


def test_approve_after_reject_raises_already_resolved() -> None:
    # 거절한 요청을 다시 승인하려 하면 안 된다
    cancel = CancelRequest("requested")
    assert cancel.reject() == "rejected"
    with pytest.raises(AlreadyResolved):
        cancel.approve()


def test_reject_after_approve_raises_already_resolved() -> None:
    # 승인한 요청을 다시 거절하려 하면 안 된다
    cancel = CancelRequest("requested")
    assert cancel.approve() == "approved"
    with pytest.raises(AlreadyResolved):
        cancel.reject()
