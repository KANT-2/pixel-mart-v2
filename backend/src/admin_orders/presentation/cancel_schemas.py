# 관리자 취소 요청 API 응답 모양 — "취소 요청" 전용이라 이름을 cancel_*로 나눠(이슈 #22와 안 겹치게)
from datetime import datetime
from typing import Literal

from app.schemas.cancel_request import CANCEL_STATUS_LABELS  # 한글 라벨 — 읽기만 한다(수정 금지 파일)
from app.schemas.common import CamelModel
from src.admin_orders.infrastructure.repositories import CancelRequestListRow

# 목록 조회 ?status= 쿼리로 받을 수 있는 값 — 모델의 CANCEL_REQUEST_STATUSES와 같다
CancelStatus = Literal["requested", "approved", "rejected"]


class AdminCancelRequestOut(CamelModel):
    """취소 요청 목록 한 줄 — 요청 정보 + 주문 상태 + 구매자 닉네임·금액"""

    id: int  # 취소 요청 id
    order_id: int  # 연결된 주문 id
    reason: str  # 취소 사유
    status: str  # requested / approved / rejected
    status_label: str  # 화면에 보여 줄 한글 이름
    created_at: datetime  # 요청 시각
    order_status: str  # 주문의 지금 상태 (cancel_requested / cancelled / preparing 등)
    buyer_nickname: str  # 주문한 사람 닉네임
    total_price: int  # 주문 금액(원)

    @classmethod
    def from_row(cls, row: CancelRequestListRow) -> "AdminCancelRequestOut":
        # 레포지토리가 돌려준 row를 그대로 API 응답 모양으로 옮긴다
        return cls(
            id=row.id,
            order_id=row.order_id,
            reason=row.reason,
            status=row.status,
            status_label=CANCEL_STATUS_LABELS[row.status],
            created_at=row.created_at,
            order_status=row.order_status,
            buyer_nickname=row.buyer_nickname,
            total_price=row.total_price,
        )
