import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.notification import Notification
from app.models.product import Category, Product
from app.models.question import ProductQuestion
from app.models.user import User
from src.questions.application.service import QuestionService
from src.questions.domain.exceptions import (
    AnsweredQuestionNotDeletable,
    InvalidQuestion,
    ProductNotFound,
    QuestionAlreadyAnswered,
    QuestionNotFound,
)
from src.questions.infrastructure.repositories import QuestionRepository

NOW = datetime(2026, 10, 26, 9, 0, tzinfo=UTC)


@dataclass(frozen=True)
class Scenario:
    author_id: int
    other_id: int
    admin_id: int
    product_id: int


@pytest.fixture
async def question_db():
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1 FROM product_questions LIMIT 1"))
    except Exception:
        await engine.dispose()
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")

    sessions = async_sessionmaker(engine, expire_on_commit=False)
    tag = uuid.uuid4().hex[:8]
    category_slug = f"questions-{tag}"
    async with sessions() as session:
        session.add(Category(slug=category_slug, name=f"문의테스트{tag}", description="", sort_order=999))
        users = [
            User(email=f"q-author-{tag}@pixelmart.test", nickname=f"문의작성{tag}", password_hash=None),
            User(email=f"q-other-{tag}@pixelmart.test", nickname=f"문의남{tag}", password_hash=None),
            User(email=f"q-admin-{tag}@pixelmart.test", nickname=f"문의관리{tag}", password_hash=None, role="admin"),
        ]
        product = Product(
            name=f"문의 서비스 상품 {tag}",
            stock=5,
            price=9_900,
            category_slug=category_slug,
            image_url="/images/products/test-only.png",
            description="테스트 전용",
            is_new=False,
        )
        session.add_all([*users, product])
        await session.commit()
        scenario = Scenario(users[0].id, users[1].id, users[2].id, product.id)

    yield sessions, scenario

    async with sessions() as session:
        user_ids = [scenario.author_id, scenario.other_id, scenario.admin_id]
        await session.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
        await session.execute(delete(ProductQuestion).where(ProductQuestion.product_id == scenario.product_id))
        await session.execute(delete(User).where(User.id.in_(user_ids)))
        await session.execute(delete(Product).where(Product.id == scenario.product_id))
        await session.execute(delete(Category).where(Category.slug == category_slug))
        await session.commit()
    await engine.dispose()


def service_for(session) -> QuestionService:
    return QuestionService(QuestionRepository(session), session, clock=lambda: NOW)


async def count_questions(sessions, product_id: int) -> int:
    async with sessions() as session:
        rows = await session.scalars(select(ProductQuestion.id).where(ProductQuestion.product_id == product_id))
        return len(rows.all())


# 쓰기
async def test_ask_saves_and_stays_after_new_session(question_db):
    sessions, s = question_db
    async with sessions() as session:
        view = await service_for(session).ask(s.author_id, s.product_id, "  배송 문의  ", "언제 와요?", False)
    assert view.title == "배송 문의"
    assert view.is_mine and not view.answered

    # 새 세션 = 새로고침해도 남아 있다
    async with sessions() as session:
        rows, total = await service_for(session).list_for_product(s.product_id, None, False, None, 1, 10)
    assert total == 1
    assert rows[0].title == "배송 문의"
    assert rows[0].nickname.startswith("문의작성")


async def test_ask_unknown_product_is_404_and_nothing_saved(question_db):
    sessions, s = question_db
    async with sessions() as session:
        with pytest.raises(ProductNotFound):
            await service_for(session).ask(s.author_id, 999_999_999, "제목", "내용", False)
        with pytest.raises(ProductNotFound):
            await service_for(session).list_for_product(999_999_999, None, False, None, 1, 10)


async def test_ask_invalid_title_is_rejected_and_nothing_saved(question_db):
    sessions, s = question_db
    async with sessions() as session:
        with pytest.raises(InvalidQuestion):
            await service_for(session).ask(s.author_id, s.product_id, "   ", "내용", False)
    assert await count_questions(sessions, s.product_id) == 0


# 목록 — 비밀글 가리기 · 필터 · 페이지
async def test_secret_question_is_masked_except_author_and_admin(question_db):
    sessions, s = question_db
    async with sessions() as session:
        await service_for(session).ask(s.author_id, s.product_id, "비밀 제목", "비밀 내용", True)

    async with sessions() as session:
        service = service_for(session)
        for viewer, is_admin, hidden in [
            (None, False, True),  # 비로그인
            (s.other_id, False, True),  # 다른 사용자
            (s.author_id, False, False),  # 작성자
            (s.admin_id, True, False),  # 관리자
        ]:
            [view], _ = await service.list_for_product(s.product_id, viewer, is_admin, None, 1, 10)
            assert view.hidden is hidden
            if hidden:
                assert (view.title, view.content, view.nickname, view.answer) == (None, None, None, None)
            else:
                assert view.content == "비밀 내용"
            assert view.is_secret is True


async def test_answered_filter_and_paging(question_db):
    sessions, s = question_db
    async with sessions() as session:
        service = service_for(session)
        ids = [(await service.ask(s.author_id, s.product_id, f"문의 {n}", "내용", False)).id for n in range(3)]
        await service.answer(ids[0], "답변", s.admin_id)

    async with sessions() as session:
        service = service_for(session)
        answered, total_answered = await service.list_for_product(s.product_id, None, False, True, 1, 10)
        waiting, total_waiting = await service.list_for_product(s.product_id, None, False, False, 1, 10)
        page2, total = await service.list_for_product(s.product_id, None, False, None, 2, 2)
    assert (total_answered, [v.id for v in answered]) == (1, [ids[0]])
    assert total_waiting == 2 and all(not v.answered for v in waiting)
    assert total == 3 and len(page2) == 1  # 3개를 2개씩 → 2페이지에 1개


# 답변
async def test_answer_saves_and_notifies_author(question_db):
    sessions, s = question_db
    async with sessions() as session:
        asked = await service_for(session).ask(s.author_id, s.product_id, "색상 문의", "다른 색도 있나요?", True)
        view = await service_for(session).answer(asked.id, "  준비 중이에요.  ", s.admin_id)
    assert (view.answer, view.answered_at, view.hidden) == ("준비 중이에요.", NOW, False)

    async with sessions() as session:
        notes = (await session.scalars(select(Notification).where(Notification.user_id == s.author_id))).all()
    assert [(n.kind, n.title, n.href, n.ref_key) for n in notes] == [
        ("question_answered", "문의에 답변이 달렸어요", f"/products/{s.product_id}", f"answer:{asked.id}")
    ]


async def test_second_answer_is_409_and_keeps_first(question_db):
    sessions, s = question_db
    async with sessions() as session:
        asked = await service_for(session).ask(s.author_id, s.product_id, "문의", "내용", False)
        await service_for(session).answer(asked.id, "첫 답변", s.admin_id)
        with pytest.raises(QuestionAlreadyAnswered):
            await service_for(session).answer(asked.id, "두 번째", s.admin_id)
    async with sessions() as session:
        [view], _ = await service_for(session).list_for_product(s.product_id, None, False, None, 1, 10)
    assert view.answer == "첫 답변"


async def test_answer_unknown_question_is_404(question_db):
    sessions, s = question_db
    async with sessions() as session:
        with pytest.raises(QuestionNotFound):
            await service_for(session).answer(999_999_999, "답변", s.admin_id)


async def test_failed_notification_rolls_back_answer(question_db):
    """알림 저장이 실패하면 답변도 저장되지 않는다 (한 트랜잭션)"""
    sessions, s = question_db

    class BrokenNotify(QuestionRepository):
        async def notify_answered(self, question):
            raise RuntimeError("알림 저장 실패")

    async with sessions() as session:
        asked = await service_for(session).ask(s.author_id, s.product_id, "문의", "내용", False)
    async with sessions() as session:
        broken = QuestionService(BrokenNotify(session), session, clock=lambda: NOW)
        with pytest.raises(RuntimeError):
            await broken.answer(asked.id, "답변", s.admin_id)
    async with sessions() as session:
        [view], _ = await service_for(session).list_for_product(s.product_id, None, False, None, 1, 10)
    assert view.answered is False and view.answer is None


# 삭제
async def test_author_deletes_own_question_before_answer(question_db):
    sessions, s = question_db
    async with sessions() as session:
        asked = await service_for(session).ask(s.author_id, s.product_id, "문의", "내용", False)
        await service_for(session).delete(asked.id, s.author_id)
    assert await count_questions(sessions, s.product_id) == 0


async def test_other_user_delete_is_404_and_question_stays(question_db):
    sessions, s = question_db
    async with sessions() as session:
        asked = await service_for(session).ask(s.author_id, s.product_id, "문의", "내용", False)
        with pytest.raises(QuestionNotFound):
            await service_for(session).delete(asked.id, s.other_id)
    assert await count_questions(sessions, s.product_id) == 1


async def test_answered_question_delete_is_409_and_question_stays(question_db):
    sessions, s = question_db
    async with sessions() as session:
        asked = await service_for(session).ask(s.author_id, s.product_id, "문의", "내용", False)
        await service_for(session).answer(asked.id, "답변", s.admin_id)
        with pytest.raises(AnsweredQuestionNotDeletable):
            await service_for(session).delete(asked.id, s.author_id)
    assert await count_questions(sessions, s.product_id) == 1


async def test_delete_unknown_question_is_404(question_db):
    sessions, s = question_db
    async with sessions() as session:
        with pytest.raises(QuestionNotFound):
            await service_for(session).delete(999_999_999, s.author_id)
            