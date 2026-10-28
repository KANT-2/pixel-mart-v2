class QuestionNotFound(Exception):
    """문의가 없거나, 남의 문의라서 없는 것처럼 숨길 때 발생한다 (404)."""

    def __init__(self) -> None:
        super().__init__("문의를 찾을 수 없어요.")


class ProductNotFound(Exception):
    """문의할 상품이 없을 때 발생한다 (404)."""

    def __init__(self) -> None:
        super().__init__("상품을 찾을 수 없어요.")


class InvalidQuestion(Exception):
    """제목·내용·답변이 비었거나 너무 길 때 발생한다 (422)."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class QuestionAlreadyAnswered(Exception):
    """이미 답변한 문의에 다시 답변할 때 발생한다 (409)."""

    def __init__(self) -> None:
        super().__init__("이미 답변한 문의예요.")


class QuestionNotAnswered(Exception):
    """답변이 없는 문의의 답변을 지우려 할 때 발생한다 (409)."""

    def __init__(self) -> None:
        super().__init__("아직 답변이 없는 문의예요.")


class AnsweredQuestionNotDeletable(Exception):
    """답변이 달린 문의를 삭제하려 할 때 발생한다 (409)."""

    def __init__(self) -> None:
        super().__init__("답변이 달린 문의는 삭제할 수 없어요.")
