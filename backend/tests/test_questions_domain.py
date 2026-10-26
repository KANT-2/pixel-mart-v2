import ast
from datetime import UTC, datetime
from pathlib import Path

import pytest

from src.questions.domain.exceptions import (
    AnsweredQuestionNotDeletable,
    InvalidQuestion,
    QuestionAlreadyAnswered,
    QuestionNotFound,
)
from src.questions.domain.question import Question

AUTHOR, OTHER = 1, 2
NOW = datetime(2026, 10, 26, 9, 0, tzinfo=UTC)


def make(**overrides) -> Question:
    values = {"product_id": 10, "author_id": AUTHOR, "title": "제목", "content": "내용", "is_secret": False}
    return Question(**{**values, **overrides})


# 제목·내용 글자 수
@pytest.mark.parametrize(("field", "limit"), [("title", 100), ("content", 500)])
def test_title_and_content_accept_boundary_lengths(field, limit):
    assert len(getattr(make(**{field: "가"}), field)) == 1
    assert len(getattr(make(**{field: "가" * limit}), field)) == limit


@pytest.mark.parametrize(("field", "limit"), [("title", 100), ("content", 500)])
@pytest.mark.parametrize("bad", ["", "   ", None])
def test_empty_title_or_content_is_rejected(field, limit, bad):
    with pytest.raises(InvalidQuestion):
        make(**{field: bad})


@pytest.mark.parametrize(("field", "limit"), [("title", 100), ("content", 500)])
def test_too_long_title_or_content_is_rejected(field, limit):
    with pytest.raises(InvalidQuestion, match=f"1~{limit}자"):
        make(**{field: "가" * (limit + 1)})


def test_title_and_content_are_trimmed():
    question = make(title="  키캡 문의  ", content="\n줄바꿈은\n안쪽만 남아요\n")
    assert question.title == "키캡 문의"
    assert question.content == "줄바꿈은\n안쪽만 남아요"


# 비밀글 보기 권한
@pytest.mark.parametrize(
    ("is_secret", "user_id", "is_admin", "expected"),
    [
        (False, None, False, True),  # 공개글은 비로그인도
        (False, OTHER, False, True),
        (True, AUTHOR, False, True),  # 비밀글: 작성자
        (True, OTHER, True, True),  # 비밀글: 관리자
        (True, OTHER, False, False),  # 비밀글: 남
        (True, None, False, False),  # 비밀글: 비로그인
    ],
)
def test_can_be_read_by(is_secret, user_id, is_admin, expected):
    assert make(is_secret=is_secret).can_be_read_by(user_id, is_admin) is expected


# 답변
def test_answer_once_records_text_and_time():
    question = make()
    assert not question.is_answered
    question.answer_with("  확인해 드릴게요.  ", NOW)
    assert question.is_answered
    assert question.answer == "확인해 드릴게요."
    assert question.answered_at == NOW


def test_second_answer_is_rejected_and_keeps_first():
    question = make()
    question.answer_with("첫 답변", NOW)
    with pytest.raises(QuestionAlreadyAnswered):
        question.answer_with("두 번째 답변", NOW)
    assert question.answer == "첫 답변"


@pytest.mark.parametrize("bad", ["", "   ", "가" * 501])
def test_invalid_answer_is_rejected_and_nothing_saved(bad):
    question = make()
    with pytest.raises(InvalidQuestion):
        question.answer_with(bad, NOW)
    assert question.answer is None
    assert question.answered_at is None


def test_answer_accepts_500_chars():
    question = make()
    question.answer_with("가" * 500, NOW)
    assert len(question.answer) == 500


# 삭제
def test_author_can_delete_before_answer():
    make().ensure_deletable_by(AUTHOR)  # 오류 없음


def test_other_user_cannot_delete_and_question_is_hidden():
    with pytest.raises(QuestionNotFound):
        make().ensure_deletable_by(OTHER)


def test_answered_question_cannot_be_deleted():
    question = make()
    question.answer_with("답변", NOW)
    with pytest.raises(AnsweredQuestionNotDeletable):
        question.ensure_deletable_by(AUTHOR)


# 도메인은 순수 파이썬 (FastAPI·SQLAlchemy·Pydantic import 금지)
def test_domain_imports_only_standard_library_and_own_domain():
    allowed = {"dataclasses", "datetime"}
    root = Path(__file__).resolve().parents[1] / "src" / "questions" / "domain"
    for path in root.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                assert all(alias.name.split(".")[0] in allowed for alias in node.names), path.name
            elif isinstance(node, ast.ImportFrom) and node.level == 0:
                assert node.module.split(".")[0] in allowed, path.name