# 관리자 대시보드 요약 레포지토리 — 주문·취소 요청·문의 테이블을 읽기 전용으로 count만 한다. 쓰기가 없어 commit도 없다.
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cancel_request import CancelRequest as CancelRequestModel
from app.models.order import Order
from app.models.question import ProductQuestion  # 문의 모델 — 읽기만 한다(수정 금지 파일)


class AdminSummaryRepository:
    """대시보드 숫자 카드 4개의 집계만 담당 — commit이 없는 순수 조회 레포지토리"""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def count_orders_since(self, since: datetime) -> int:
        # 오늘 들어온 주문 — 상태 무관(취소 포함), created_at이 since(오늘 KST 자정) 이후인 것만 센다
        return await self.session.scalar(select(func.count()).select_from(Order).where(Order.created_at >= since)) or 0

    async def count_orders_by_status(self, status: str) -> int:
        # 배송 준비중(preparing) 같은 특정 상태의 주문 수
        return await self.session.scalar(select(func.count()).select_from(Order).where(Order.status == status)) or 0

    async def count_cancel_requests_by_status(self, status: str) -> int:
        # 취소 요청 대기(requested) 같은 특정 상태의 취소 요청 수
        return (
            await self.session.scalar(
                select(func.count()).select_from(CancelRequestModel).where(CancelRequestModel.status == status)
            )
            or 0
        )

    async def count_unanswered_questions(self) -> int:
        # 답변이 없는(answer가 None인) 문의 수
        return (
            await self.session.scalar(
                select(func.count()).select_from(ProductQuestion).where(ProductQuestion.answer.is_(None))
            )
            or 0
        )
