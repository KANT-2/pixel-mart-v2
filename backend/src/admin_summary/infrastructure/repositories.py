# 관리자 대시보드 요약 레포지토리 — 주문·취소·문의·상품을 읽기 전용으로 count·집계만 한다. 쓰기가 없어 commit도 없다.
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cancel_request import CancelRequest as CancelRequestModel
from app.models.order import Order
from app.models.product import Product  # 재고·등급·숨김 여부 — 읽기만 한다(다른 팀원 소유 테이블)
from app.models.question import ProductQuestion  # 문의 모델 — 읽기만 한다(수정 금지 파일)
from src.orders.domain.order import STATUS_LABELS  # 주문 상태 6종의 정확한 키 — 읽기만 한다(수정 금지 파일)


@dataclass
class LowStockProduct:
    """재고 부족 목록 한 줄 — 상품 테이블에서 필요한 필드만 뽑은 순수 데이터 그릇"""

    id: int
    name: str
    rarity: str
    stock: int


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

    async def group_orders_by_status(self) -> dict[str, int]:
        # 상태 6종을 0으로 깔아 두고, GROUP BY 결과로 실제 값을 덮어쓴다(건수 0인 상태도 응답에 그대로 나오게)
        counts = {status: 0 for status in STATUS_LABELS}
        rows = await self.session.execute(select(Order.status, func.count()).group_by(Order.status))
        for status, count in rows.all():
            counts[status] = count
        return counts

    async def low_stock_products(self, threshold: int, limit: int) -> list[LowStockProduct]:
        # 재고가 threshold 이하인 상품을 재고 적은 순으로, 숨김 상품은 제외하고 최대 limit개만 가져온다
        rows = await self.session.execute(
            select(Product.id, Product.name, Product.rarity, Product.stock)
            .where(Product.stock <= threshold, Product.is_hidden.is_(False))
            .order_by(Product.stock.asc(), Product.id.asc())
            .limit(limit)
        )
        return [
            LowStockProduct(id=id_, name=name, rarity=rarity, stock=stock) for id_, name, rarity, stock in rows.all()
        ]
