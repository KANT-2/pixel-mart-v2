from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.schemas.common import CamelModel
from src.questions.application.service import AdminQuestionView, QuestionView

# 글자 수 제한은 도메인(Question)·프론트(lib/questions.ts)와 같다
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Answer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class QuestionIn(CamelModel):
    """문의 쓰기 요청 — { title, content, isSecret }"""

    title: Title
    content: Content
    is_secret: bool = False


class AnswerIn(CamelModel):
    """관리자 답변 요청 — { answer } (1~500자)"""

    answer: Answer


class QuestionOut(CamelModel):
    """문의 한 개 — 기존 응답(app/schemas/question.py)과 같은 칸. 비밀글을 남이 보면 서버에서 null로 가린다"""

    id: int
    product_id: int
    title: str | None
    content: str | None
    nickname: str | None
    is_secret: bool
    hidden: bool
    answered: bool
    answer: str | None
    answered_at: datetime | None
    created_at: datetime | None
    is_mine: bool = False

    @classmethod
    def from_view(cls, view: QuestionView) -> "QuestionOut":
        return cls(
            id=view.id,
            product_id=view.product_id,
            title=view.title,
            content=view.content,
            nickname=view.nickname,
            is_secret=view.is_secret,
            hidden=view.hidden,
            answered=view.answered,
            answer=view.answer,
            answered_at=view.answered_at,
            created_at=view.created_at,
            is_mine=view.is_mine,
        )


class AdminQuestionOut(QuestionOut):
    """관리자 목록 한 줄 — QuestionOut + productName · authorNickname (ADMIN_API.md 5장)"""

    product_name: str
    author_nickname: str

    @classmethod
    def from_admin_view(cls, view: AdminQuestionView) -> "AdminQuestionOut":
        base = QuestionOut.from_view(view.question).model_dump()
        return cls(**base, product_name=view.product_name, author_nickname=view.author_nickname)
