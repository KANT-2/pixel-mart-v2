from dataclasses import dataclass
from typing import Literal

AdminTradeStatus = Literal["open", "hidden"]
HIDDEN_BY_ADMIN_MESSAGE = "운영 정책으로 숨겨진 글이에요."


class TradeNotFound(Exception):
    def __init__(self) -> None:
        super().__init__("거래글을 찾을 수 없어요.")


class CannotReopen(Exception):
    """글쓴이가 스스로 숨긴 글을 관리자가 다시 열려 할 때 (400)."""

    def __init__(self) -> None:
        super().__init__("글쓴이가 직접 숨긴 글은 다시 열 수 없어요.")


@dataclass(frozen=True)
class TradeState:
    id: int
    owner_id: int
    status: str
    hidden_by_admin: bool


def moderate(post: TradeState, target: AdminTradeStatus) -> tuple[str, bool]:
    """관리자가 바꾼 뒤의 (status, hidden_by_admin). 다시 보이기는 관리자가 숨긴 글만."""
    if target == "hidden":
        return "hidden", True
    if not post.hidden_by_admin:
        raise CannotReopen()
    return "open", False


def newly_hidden(post: TradeState, target: AdminTradeStatus) -> bool:
    """이번에 처음 숨기는 경우만 글쓴이에게 알린다."""
    return target == "hidden" and not post.hidden_by_admin
