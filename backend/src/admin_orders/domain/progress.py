# 주문 배송 단계 전이 — 결제완료 → 준비중 → 배송중 → 배송완료 한 칸씩만 넘어간다
from .exceptions import InvalidTransition  # 더 못 넘기는 상태에서 advance()를 부르면 이 예외를 올린다

# 한 칸씩만 진행하는 정상 흐름 — 순서가 바뀌면 안 되므로 튜플로 고정한다
FLOW: tuple[str, ...] = ("paid", "preparing", "shipping", "delivered")


class OrderProgress:
    """주문 하나의 배송 상태를 들고, advance()로 한 칸씩만 앞으로 보낸다"""

    def __init__(self, status: str) -> None:
        # 생성 시점의 상태를 그대로 저장한다 (paid/preparing/shipping/delivered/cancel_requested/cancelled)
        self.status = status

    def advance(self) -> str:
        # FLOW에 없는 상태(cancel_requested, cancelled)는 더 넘길 수 없다
        if self.status not in FLOW:
            raise InvalidTransition()
        index = FLOW.index(self.status)  # 지금 상태가 FLOW에서 몇 번째인지
        # 이미 마지막 단계(delivered)면 더 넘길 수 없다
        if index == len(FLOW) - 1:
            raise InvalidTransition()
        # 바로 다음 단계로 한 칸만 이동한다
        self.status = FLOW[index + 1]
        return self.status
