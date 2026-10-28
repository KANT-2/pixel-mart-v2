# 관리자 주문 도메인(순수 파이썬) 테스트 — DB·FastAPI 없이 상태 전이 규칙만 확인한다
import pytest  # 예외 발생을 확인하는 pytest.raises를 쓴다

from src.admin_orders.domain.cancel import CancelRequest, status_before_cancel
from src.admin_orders.domain.csv_export import sanitize_csv_cell
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


def test_status_before_cancel_returns_latest_status_outside_cancel_flow() -> None:
    # 타임라인에서 cancel_requested를 빼고 가장 최근 상태(preparing)를 찾는다
    assert status_before_cancel(["paid", "preparing", "cancel_requested"]) == "preparing"


def test_status_before_cancel_skips_multiple_cancel_flow_entries() -> None:
    # 취소 흐름 상태가 여러 번 쌓여 있어도 그 이전의 진짜 상태를 찾는다
    assert status_before_cancel(["paid", "cancel_requested", "cancelled"]) == "paid"


def test_status_before_cancel_raises_value_error_without_prior_status() -> None:
    # 취소 흐름 이전 기록이 하나도 없으면 데이터가 잘못된 것이므로 ValueError
    with pytest.raises(ValueError):
        status_before_cancel(["cancel_requested"])


def test_sanitize_csv_cell_escapes_formula_prefixes_and_leaves_other_values_alone() -> None:
    # =, +, -, @로 시작하면 수식으로 해석되지 않게 앞에 '를 붙인다 (CSV 수식 주입 방지, 이슈 #99)
    assert sanitize_csv_cell("=HYPERLINK(\"http://evil\")") == "'=HYPERLINK(\"http://evil\")"
    assert sanitize_csv_cell("+1-234-5678") == "'+1-234-5678"
    assert sanitize_csv_cell("-10") == "'-10"
    assert sanitize_csv_cell("@someone") == "'@someone"
    assert sanitize_csv_cell("홍길동") == "홍길동"
    assert sanitize_csv_cell("") == ""
