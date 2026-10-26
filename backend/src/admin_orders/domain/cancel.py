# 취소 요청 승인/거절 — 아직 처리 안 된(requested) 요청만 승인하거나 거절할 수 있다
from collections.abc import Sequence  # status_before_cancel이 받는 타임라인 목록의 타입

from .exceptions import AlreadyResolved  # 이미 처리된 요청을 또 처리하려 하면 이 예외를 올린다

# 취소 흐름에 들어간 상태 — 거절되면 이 상태들이 아닌 가장 최근 상태로 돌아간다
CANCEL_FLOW = ("cancel_requested", "cancelled")


def status_before_cancel(history: Sequence[str]) -> str:
    """취소 신청 직전 상태 — 타임라인에서 cancel_requested/cancelled가 아닌 가장 최근 상태를 찾는다"""
    for status in reversed(history):  # 최신 기록부터 거꾸로 훑는다
        if status not in CANCEL_FLOW:
            return status
    # 취소 흐름 이전 기록이 하나도 없으면(데이터가 잘못된 것) 더 진행할 수 없다
    raise ValueError("취소 신청 이전의 상태 기록이 없습니다.")


class CancelRequest:
    """취소 요청 하나의 상태를 들고, approve()/reject()로 한 번만 처리한다"""

    def __init__(self, status: str) -> None:
        # 생성 시점의 상태를 그대로 저장한다 (requested/approved/rejected)
        self.status = status

    def approve(self) -> str:
        # requested가 아니면(이미 approved거나 rejected면) 다시 처리할 수 없다
        if self.status != "requested":
            raise AlreadyResolved()
        self.status = "approved"
        return self.status

    def reject(self) -> str:
        # requested가 아니면(이미 approved거나 rejected면) 다시 처리할 수 없다
        if self.status != "requested":
            raise AlreadyResolved()
        self.status = "rejected"
        return self.status
