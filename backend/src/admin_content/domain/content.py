from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Notice:
    id: int
    title: str
    content: str
    is_pinned: bool
    is_published: bool
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class Faq:
    id: int
    category: str
    question: str
    answer: str
    sort_order: int


class NoticeNotFound(Exception):
    def __init__(self) -> None:
        super().__init__("공지를 찾을 수 없어요.")


class FaqNotFound(Exception):
    def __init__(self) -> None:
        super().__init__("FAQ를 찾을 수 없어요.")
