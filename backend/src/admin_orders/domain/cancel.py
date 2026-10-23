# 취소 요청 승인/거절 — 아직 처리 안 된(requested) 요청만 승인하거나 거절할 수 있다
from .exceptions import AlreadyResolved  # 이미 처리된 요청을 또 처리하려 하면 이 예외를 올린다


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
