# 관리자 대시보드 요약 서비스 — 숫자 4개를 순서대로(gather 없이) 센다. 전부 읽기 전용이라 커밋/롤백이 필요 없다.
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from typing import Protocol

KST = timezone(timedelta(hours=9))  # badges.py의 KST 상수와 같은 값 — 한국 시간 자정 계산용


def kst_today_start(now: datetime | None = None) -> datetime:
    """오늘 KST 0시 — now를 주입할 수 있어 테스트가 "현재 시각"에 의존하지 않게 한다."""
    local = (now or datetime.now(UTC)).astimezone(KST)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


@dataclass
class AdminSummaryCounts:
    """카드 4개의 숫자 그릇"""

    orders_today: int
    preparing_orders: int
    pending_cancel_requests: int
    unanswered_questions: int


# 저장소가 갖춰야 할 모양 — 실제 구현은 infrastructure/repositories.py의 AdminSummaryRepository
class Summary(Protocol):
    async def count_orders_since(self, since: datetime) -> int: ...
    async def count_orders_by_status(self, status: str) -> int: ...
    async def count_cancel_requests_by_status(self, status: str) -> int: ...
    async def count_unanswered_questions(self) -> int: ...


class AdminSummaryService:
    def __init__(self, summary: Summary) -> None:
        self.summary = summary

    async def get_summary(self, now: datetime | None = None) -> AdminSummaryCounts:
        # 같은 세션으로 순차 실행 (gather 금지 — 4번 다 가벼운 count라 병렬이 필요 없다)
        today_start = kst_today_start(now)
        orders_today = await self.summary.count_orders_since(today_start)
        preparing_orders = await self.summary.count_orders_by_status("preparing")
        pending_cancel_requests = await self.summary.count_cancel_requests_by_status("requested")
        unanswered_questions = await self.summary.count_unanswered_questions()
        return AdminSummaryCounts(
            orders_today=orders_today,
            preparing_orders=preparing_orders,
            pending_cancel_requests=pending_cancel_requests,
            unanswered_questions=unanswered_questions,
        )
