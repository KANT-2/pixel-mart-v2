# 관리자 대시보드 요약 API 응답 모양
from app.schemas.common import CamelModel
from src.admin_summary.application.service import AdminSummaryCounts
from src.admin_summary.infrastructure.repositories import LowStockProduct


class AdminOrderStatusCountsOut(CamelModel):
    """주문 단계별 현황 막대가 쓰는 상태 6종 건수"""

    paid: int  # 주문 완료
    preparing: int  # 상품 준비중
    shipping: int  # 배송중
    delivered: int  # 배송 완료
    cancel_requested: int  # 취소 요청
    cancelled: int  # 취소 완료


class AdminLowStockProductOut(CamelModel):
    """재고 부족 목록 한 줄"""

    id: int  # 상품 번호
    name: str  # 상품 이름
    rarity: str  # 등급(common/rare/epic/unique) — 프론트의 rarity.ts가 라벨·색을 맡는다
    stock: int  # 남은 재고

    @classmethod
    def from_product(cls, product: LowStockProduct) -> "AdminLowStockProductOut":
        return cls(id=product.id, name=product.name, rarity=product.rarity, stock=product.stock)


class AdminSummaryOut(CamelModel):
    """대시보드 숫자 카드 4개 + 주문 단계별 현황 + 재고 부족 목록 — camelCase로 그대로 내려간다"""

    orders_today: int  # 오늘 들어온 주문 수(상태 무관, 취소 포함)
    preparing_orders: int  # 배송 준비중(preparing) 주문 수
    pending_cancel_requests: int  # 취소 요청 대기(requested) 수
    unanswered_questions: int  # 미답변 문의 수
    order_status_counts: AdminOrderStatusCountsOut  # 주문 상태 6종 건수
    low_stock_products: list[AdminLowStockProductOut]  # 재고 10개 이하 상품(숨김 제외, 재고순 최대 20개)

    @classmethod
    def from_counts(cls, counts: AdminSummaryCounts) -> "AdminSummaryOut":
        return cls(
            orders_today=counts.orders_today,
            preparing_orders=counts.preparing_orders,
            pending_cancel_requests=counts.pending_cancel_requests,
            unanswered_questions=counts.unanswered_questions,
            order_status_counts=AdminOrderStatusCountsOut(**counts.order_status_counts),
            low_stock_products=[AdminLowStockProductOut.from_product(p) for p in counts.low_stock_products],
        )
