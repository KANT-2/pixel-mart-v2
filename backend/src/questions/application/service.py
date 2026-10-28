from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from src.questions.domain.exceptions import ProductNotFound, QuestionNotFound
from src.questions.domain.question import Question

# (문의, 작성자 닉네임)
Authored = tuple[Question, str]
# (문의, 작성자 닉네임, 상품 이름)
AdminRow = tuple[Question, str, str]


class Questions(Protocol):
    async def product_exists(self, product_id: int) -> bool: ...
    async def get(self, question_id: int) -> Authored | None: ...
    async def add(self, question: Question) -> Authored: ...
    async def list_for_product(
        self, product_id: int, answered: bool | None, offset: int, limit: int
    ) -> tuple[list[Authored], int]: ...
    async def list_for_admin(
        self, answered: bool | None, query: str | None, offset: int, limit: int
    ) -> tuple[list[AdminRow], int]: ...
    async def save_answer(self, question: Question) -> None: ...
    async def save_hidden(self, question_id: int, hidden: bool) -> None: ...
    async def notify_answered(self, question: Question) -> None: ...
    async def delete(self, question_id: int) -> None: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


@dataclass(frozen=True)
class QuestionView:
    """화면에 내보낼 문의 한 개 — 볼 권한이 없으면 서버에서 내용을 비운다"""

    id: int
    product_id: int
    title: str | None
    content: str | None
    nickname: str | None
    is_secret: bool
    hidden: bool
    answered: bool  # 비밀글이어도 답변 대기/완료 표시는 보인다
    answer: str | None
    answered_at: datetime | None
    created_at: datetime | None
    is_mine: bool


def to_view(authored: Authored, viewer_id: int | None, is_admin: bool = False) -> QuestionView:
    question, nickname = authored
    hidden = not question.can_be_read_by(viewer_id, is_admin)
    assert question.id is not None
    return QuestionView(
        id=question.id,
        product_id=question.product_id,
        title=None if hidden else question.title,
        content=None if hidden else question.content,
        nickname=None if hidden else nickname,
        is_secret=question.is_secret,
        hidden=hidden,
        answered=question.is_answered,
        answer=None if hidden else question.answer,
        answered_at=question.answered_at,
        created_at=question.created_at,
        is_mine=viewer_id is not None and viewer_id == question.author_id,
    )


@dataclass(frozen=True)
class AdminQuestionView:
    """관리자 목록 한 줄 — 비밀글도 내용이 보이고, 상품 이름·작성자 닉네임이 붙는다"""

    question: QuestionView
    product_name: str
    author_nickname: str
    is_hidden: bool


class QuestionService:
    """조회 → 도메인 규칙 → 저장 → commit. 중간에 실패하면 rollback해서 아무것도 남기지 않는다."""

    def __init__(
        self,
        questions: Questions,
        tx: Transaction,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self.questions = questions
        self.tx = tx
        self.clock = clock

    async def ask(self, user_id: int, product_id: int, title: str, content: str, is_secret: bool) -> QuestionView:
        """문의 쓰기 — 없는 상품 404, 빈 제목·내용 422"""
        if not await self.questions.product_exists(product_id):
            raise ProductNotFound()
        question = Question(product_id, user_id, title, content, is_secret)  # 규칙 위반이면 여기서 멈춘다
        try:
            saved = await self.questions.add(question)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return to_view(saved, user_id)

    async def list_for_product(
        self,
        product_id: int,
        viewer_id: int | None,
        is_admin: bool,
        answered: bool | None,
        page: int,
        size: int,
    ) -> tuple[list[QuestionView], int]:
        """상품 문의 목록 — 최신순, 비밀글은 작성자·관리자 말고는 내용을 비워서 준다"""
        if not await self.questions.product_exists(product_id):
            raise ProductNotFound()
        rows, total = await self.questions.list_for_product(product_id, answered, (page - 1) * size, size)
        return [to_view(row, viewer_id, is_admin) for row in rows], total

    async def list_for_admin(
        self, admin_id: int, answered: bool | None, query: str | None, page: int, size: int
    ) -> tuple[list[AdminQuestionView], int]:
        """관리자 문의 목록 — 모든 상품 · 최신순 · 답변 여부 필터 · 상품 이름/제목 검색"""
        rows, total = await self.questions.list_for_admin(answered, query, (page - 1) * size, size)
        views = [
            AdminQuestionView(
                to_view((question, nickname), admin_id, is_admin=True), product_name, nickname, question.is_hidden
            )
            for question, nickname, product_name in rows
        ]
        return views, total

    async def answer(self, question_id: int, text: str, admin_id: int) -> QuestionView:
        """관리자 답변 — 답변 저장과 작성자 알림을 한 트랜잭션으로"""
        authored = await self.questions.get(question_id)
        if authored is None:
            raise QuestionNotFound()
        question, nickname = authored
        question.answer_with(text, self.clock())  # 두 번째 답변은 409, 빈 답변은 422
        try:
            await self.questions.save_answer(question)
            await self.questions.notify_answered(question)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return to_view((question, nickname), admin_id, is_admin=True)

    async def _found(self, question_id: int) -> Question:
        authored = await self.questions.get(question_id)
        if authored is None:
            raise QuestionNotFound()
        return authored[0]

    async def _commit(self, *steps) -> None:
        try:
            for step in steps:
                await step
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise

    async def set_hidden(self, question_id: int, hidden: bool) -> None:
        """관리자 숨김 · 다시 보이기 — 숨긴 문의는 손님 목록에서 빠진다"""
        question = await self._found(question_id)
        await self._commit(self.questions.save_hidden(question_id, hidden))
        question.is_hidden = hidden

    async def delete_answer(self, question_id: int) -> None:
        """관리자 답변 삭제 — 답변 대기로 돌아가 다시 답변할 수 있다. 답변이 없으면 409"""
        question = await self._found(question_id)
        question.remove_answer()
        await self._commit(self.questions.save_answer(question))

    async def admin_delete(self, question_id: int) -> None:
        """관리자 문의 삭제 — 답변이 달려 있어도 지울 수 있다 (운영 정책 위반 글)"""
        await self._found(question_id)
        await self._commit(self.questions.delete(question_id))

    async def delete(self, question_id: int, user_id: int) -> None:
        """내 문의 삭제 — 남의 문의 404, 답변 달린 문의 409"""
        authored = await self.questions.get(question_id)
        if authored is None:
            raise QuestionNotFound()
        question, _ = authored
        question.ensure_deletable_by(user_id)
        try:
            await self.questions.delete(question_id)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
