from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints, model_validator

from app.schemas.common import CamelModel
from src.admin_content.domain.content import Faq, Notice

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5_000)]
Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Answer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2_000)]


class Changes(CamelModel):
    @model_validator(mode="after")
    def require_changes(self):
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("바꿀 정보를 보내 주세요.")
        return self

    def values(self) -> dict[str, object]:
        return {field: getattr(self, field) for field in self.model_fields_set}


class NoticeIn(CamelModel):
    title: Title
    content: Content
    is_pinned: bool = False
    is_published: bool = False

    def values(self) -> dict[str, object]:
        return self.model_dump()


class NoticeUpdateIn(Changes):
    title: Title | None = None
    content: Content | None = None
    is_pinned: bool | None = None
    is_published: bool | None = None


class NoticeListOut(CamelModel):
    id: int
    title: str
    is_pinned: bool
    created_at: datetime

    @classmethod
    def from_domain(cls, notice: Notice) -> "NoticeListOut":
        return cls(id=notice.id, title=notice.title, is_pinned=notice.is_pinned, created_at=notice.created_at)


class NoticeOut(NoticeListOut):
    content: str
    updated_at: datetime

    @classmethod
    def from_domain(cls, notice: Notice) -> "NoticeOut":
        return cls(**notice.__dict__)


class AdminNoticeOut(NoticeOut):
    is_published: bool


class FaqIn(CamelModel):
    category: Category
    question: Question
    answer: Answer
    sort_order: int = 0

    def values(self) -> dict[str, object]:
        return self.model_dump()


class FaqUpdateIn(Changes):
    category: Category | None = None
    question: Question | None = None
    answer: Answer | None = None
    sort_order: int | None = None


class AdminFaqOut(CamelModel):
    id: int
    category: str
    question: str
    answer: str
    sort_order: int

    @classmethod
    def from_domain(cls, faq: Faq) -> "AdminFaqOut":
        return cls(**faq.__dict__)
