from dataclasses import dataclass
from datetime import datetime

from src.auth.domain.exceptions import CannotWithdraw

WITHDRAW_CONFIRM = "탈퇴"
WITHDRAWN_NAME = "탈퇴한 모험가"
# 배송이 끝나기 전 주문 — 이 상태가 하나라도 있으면 탈퇴를 막는다 (ADMIN_API.md 5-1장)
ACTIVE_ORDER_STATUSES = (
    "paid",
    "preparing",
    "shipping",
    "cancel_requested",
    "return_requested",
    "exchange_requested",
)


@dataclass(frozen=True)
class WithdrawTarget:
    id: int
    role: str
    deleted_at: datetime | None
    active_orders: int


def check_can_withdraw(target: WithdrawTarget) -> None:
    """탈퇴해도 되는지 판단한다. 안 되면 CannotWithdraw(400)."""
    if target.deleted_at is not None:
        raise CannotWithdraw("이미 탈퇴한 계정이에요.")
    if target.role == "admin":
        raise CannotWithdraw("관리자 계정은 탈퇴할 수 없어요.")
    if target.active_orders > 0:
        raise CannotWithdraw("진행 중인 주문이 있어 탈퇴할 수 없어요. 배송 완료 후 다시 시도해 주세요.")


def withdrawn_email(user_id: int) -> str:
    """같은 이메일로 다시 가입할 수 있게 원래 이메일을 비운다."""
    return f"deleted-{user_id}@deleted.pixelmart"


def withdrawn_nickname(user_id: int) -> str:
    """닉네임은 대소문자 무시 유일이라 id로 겹치지 않게 만든다."""
    return f"탈퇴#{user_id}"


def display_nickname(nickname: str, deleted_at: datetime | None) -> str:
    """리뷰·문의 작성자처럼 화면에 보일 이름. 탈퇴했으면 닉네임 대신 '탈퇴한 모험가'."""
    return WITHDRAWN_NAME if deleted_at is not None else nickname
