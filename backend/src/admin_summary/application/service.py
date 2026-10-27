# 관리자 대시보드 요약 서비스 — 숫자들을 순서대로(gather 없이) 센다. 전부 읽기 전용이라 커밋/롤백이 필요 없다.
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from typing import Protocol

from src.admin_summary.infrastructure.repositories import LowStockProduct

KST = timezone(timedelta(hours=9))  # badges.py의 KST 상수와 같은 값 — 한국 시간 자정 계산용
LOW_STOCK_THRESHOLD = 10  # 대시보드 재고 부족 표시 전용 기준 — 다른 기능과 공유하지 않는다
LOW_STOCK_LIMIT = 20  # 재고 부족 목록 최대 개수


def kst_today_start(now: datetime | None = None) -> datetime:
    """오늘 KST 0시 — now를 주입할 수 있어 테스트가 "현재 시각"에 의존하지 않게 한다."""
    local = (now or datetime.now(UTC)).astimezone(KST)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


@dataclass
class AdminSummaryCounts:
    """숫자 카드 4개 + 주문 단계별 현황 + 재고 부족 목록을 담는 그릇"""

    orders_today: int
    preparing_orders: int
    pending_cancel_requests: int
    unanswered_questions: int
    order_status_counts: dict[str, int]
    low_stock_products: list[LowStockProduct]


# 저장소가 갖춰야 할 모양 — 실제 구현은 infrastructure/repositories.py의 AdminSummaryRepository
class Summary(Protocol):
    async def count_orders_since(self, since: datetime) -> int: ...
    async def count_orders_by_status(self, status: str) -> int: ...
    async def count_cancel_requests_by_status(self, status: str) -> int: ...
    async def count_unanswered_questions(self) -> int: ...
    async def group_orders_by_status(self) -> dict[str, int]: ...
    async def low_stock_products(self, threshold: int, limit: int) -> list[LowStockProduct]: ...


class AdminSummaryService:
    def __init__(self, summary: Summary) -> None:
        self.summary = summary

    async def get_summary(self, now: datetime | None = None) -> AdminSummaryCounts:
        # 같은 세션으로 순차 실행 (gather 금지 — 전부 가벼운 조회라 병렬이 필요 없다)
        today_start = kst_today_start(now)
        orders_today = await self.summary.count_orders_since(today_start)
        preparing_orders = await self.summary.count_orders_by_status("preparing")
        pending_cancel_requests = await self.summary.count_cancel_requests_by_status("requested")
        unanswered_questions = await self.summary.count_unanswered_questions()
        order_status_counts = await self.summary.group_orders_by_status()
        low_stock_products = await self.summary.low_stock_products(LOW_STOCK_THRESHOLD, LOW_STOCK_LIMIT)
        return AdminSummaryCounts(
            orders_today=orders_today,
            preparing_orders=preparing_orders,
            pending_cancel_requests=pending_cancel_requests,
            unanswered_questions=unanswered_questions,
            order_status_counts=order_status_counts,
            low_stock_products=low_stock_products,
        )
