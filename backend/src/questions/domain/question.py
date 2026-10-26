from dataclasses import dataclass
from datetime import datetime

from .exceptions import AnsweredQuestionNotDeletable, InvalidQuestion, QuestionAlreadyAnswered, QuestionNotFound

# 글자 수 제한 — 프론트(lib/questions.ts)·DB 칸 길이와 같다
TITLE_MAX = 100
CONTENT_MAX = 500
ANSWER_MAX = 500


def _clean(text: str, label: str, max_length: int) -> str:
    """앞뒤 공백을 지운 뒤 1~max_length자인지 확인한다."""
    value = text.strip() if isinstance(text, str) else ""
    if not 1 <= len(value) <= max_length:
        raise InvalidQuestion(f"{label}은 1~{max_length}자로 입력해 주세요.")
    return value


@dataclass
class Question:
    """상품 문의 — 값 검사와 업무 규칙만 담는다 (FastAPI·DB를 모른다)."""

    product_id: int
    author_id: int
    title: str
    content: str
    is_secret: bool = False
    id: int | None = None
    answer: str | None = None
    answered_at: datetime | None = None
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        self.title = _clean(self.title, "제목", TITLE_MAX)
        self.content = _clean(self.content, "내용", CONTENT_MAX)

    @property
    def is_answered(self) -> bool:
        return self.answer is not None

    def can_be_read_by(self, user_id: int | None, is_admin: bool = False) -> bool:
        """비밀글은 작성자와 관리자만 내용을 볼 수 있다."""
        if not self.is_secret or is_admin:
            return True
        return user_id is not None and user_id == self.author_id

    def answer_with(self, text: str, now: datetime) -> None:
        """답변은 한 번만, 1~500자."""
        if self.is_answered:
            raise QuestionAlreadyAnswered()
        self.answer = _clean(text, "답변", ANSWER_MAX)
        self.answered_at = now

    def ensure_deletable_by(self, user_id: int) -> None:
        """본인만, 답변 전에만 삭제할 수 있다. 남의 문의는 있다는 것도 숨긴다."""
        if user_id != self.author_id:
            raise QuestionNotFound()
        if self.is_answered:
            raise AnsweredQuestionNotDeletable()