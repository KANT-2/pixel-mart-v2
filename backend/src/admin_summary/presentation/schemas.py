# 관리자 대시보드 요약 API 응답 모양
from app.schemas.common import CamelModel
from src.admin_summary.application.service import AdminSummaryCounts


class AdminSummaryOut(CamelModel):
    """대시보드 숫자 카드 4개 — camelCase로 그대로 내려간다"""

    orders_today: int  # 오늘 들어온 주문 수(상태 무관, 취소 포함)
    preparing_orders: int  # 배송 준비중(preparing) 주문 수
    pending_cancel_requests: int  # 취소 요청 대기(requested) 수
    unanswered_questions: int  # 미답변 문의 수

    @classmethod
    def from_counts(cls, counts: AdminSummaryCounts) -> "AdminSummaryOut":
        return cls(
            orders_today=counts.orders_today,
            preparing_orders=counts.preparing_orders,
            pending_cancel_requests=counts.pending_cancel_requests,
            unanswered_questions=counts.unanswered_questions,
        )
