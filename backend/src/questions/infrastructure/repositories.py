from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.question import ProductQuestion
from app.services import notifications
from src.questions.domain.question import Question

# (문의, 작성자 닉네임) — 닉네임은 화면 표시용이라 도메인 밖에서 함께 넘긴다
Authored = tuple[Question, str]
# (문의, 작성자 닉네임, 상품 이름) — 관리자 목록용
AdminRow = tuple[Question, str, str]


def _to_domain(row: ProductQuestion) -> Authored:
    question = Question(
        id=row.id,
        product_id=row.product_id,
        author_id=row.user_id,
        title=row.title,
        content=row.content,
        is_secret=row.is_secret,
        answer=row.answer,
        answered_at=row.answered_at,
        created_at=row.created_at,
    )
    return question, row.user.nickname


class QuestionRepository:
    """기존 product_questions ORM과 Question 도메인을 연결한다. commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def product_exists(self, product_id: int) -> bool:
        return await self.session.scalar(select(Product.id).where(Product.id == product_id)) is not None

    async def get(self, question_id: int) -> Authored | None:
        row = await self.session.scalar(
            select(ProductQuestion)
            .where(ProductQuestion.id == question_id)
            .execution_options(populate_existing=True)
        )
        return None if row is None else _to_domain(row)

    async def add(self, question: Question) -> Authored:
        row = ProductQuestion(
            product_id=question.product_id,
            user_id=question.author_id,
            title=question.title,
            content=question.content,
            is_secret=question.is_secret,
        )
        self.session.add(row)
        await self.session.flush()  # id·created_at을 DB에서 받아 온다
        saved = await self.get(row.id)
        assert saved is not None
        return saved

    async def list_for_product(
        self, product_id: int, answered: bool | None, offset: int, limit: int
    ) -> tuple[list[Authored], int]:
        """(이번 페이지 문의, 전체 개수) — 최신순. answered=None이면 전체"""
        filters = [ProductQuestion.product_id == product_id]
        if answered is True:
            filters.append(ProductQuestion.answer.is_not(None))
        elif answered is False:
            filters.append(ProductQuestion.answer.is_(None))

        total = await self.session.scalar(select(func.count(ProductQuestion.id)).where(*filters)) or 0
        rows = await self.session.scalars(
            select(ProductQuestion)
            .where(*filters)
            .order_by(ProductQuestion.created_at.desc(), ProductQuestion.id.desc())
            .offset(offset)
            .limit(limit)
            .execution_options(populate_existing=True)
        )
        return [_to_domain(row) for row in rows], total

    async def list_for_admin(
        self, answered: bool | None, query: str | None, offset: int, limit: int
    ) -> tuple[list[AdminRow], int]:
        """관리자 문의 목록 — 모든 상품 · 최신순. query는 상품 이름·문의 제목에서 찾는다"""
        filters = []
        if answered is True:
            filters.append(ProductQuestion.answer.is_not(None))
        elif answered is False:
            filters.append(ProductQuestion.answer.is_(None))
        if query:
            # %·_를 글자 그대로 찾도록 이스케이프 (주문 검색과 같은 방식)
            escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            filters.append(
                or_(
                    Product.name.ilike(pattern, escape="\\"),
                    ProductQuestion.title.ilike(pattern, escape="\\"),
                )
            )

        joined = select(ProductQuestion).join(Product, Product.id == ProductQuestion.product_id).where(*filters)
        total = await self.session.scalar(select(func.count()).select_from(joined.subquery())) or 0
        rows = await self.session.execute(
            select(ProductQuestion, Product.name)
            .join(Product, Product.id == ProductQuestion.product_id)
            .where(*filters)
            .order_by(ProductQuestion.created_at.desc(), ProductQuestion.id.desc())
            .offset(offset)
            .limit(limit)
            .execution_options(populate_existing=True)
        )
        return [(*_to_domain(row), product_name) for row, product_name in rows.all()], total

    async def save_answer(self, question: Question) -> None:
        row = await self.session.get(ProductQuestion, question.id)
        assert row is not None
        row.answer = question.answer
        row.answered_at = question.answered_at
        await self.session.flush()

    async def notify_answered(self, question: Question) -> None:
        """문의 작성자에게 답변 알림 (ADMIN_API.md 8장 — 같은 문의는 한 번만)"""
        await notifications.notify(
            self.session,
            question.author_id,
            "question_answered",
            "문의에 답변이 달렸어요",
            question.title,
            f"/products/{question.product_id}",
            f"answer:{question.id}",
        )

    async def delete(self, question_id: int) -> None:
        await self.session.execute(delete(ProductQuestion).where(ProductQuestion.id == question_id))
