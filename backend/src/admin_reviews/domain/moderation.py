from dataclasses import dataclass


class ReviewNotFound(Exception):
    def __init__(self) -> None:
        super().__init__("리뷰를 찾을 수 없어요.")


@dataclass(frozen=True)
class ReviewState:
    id: int
    writer_id: int
    product_id: int
    is_hidden: bool


def newly_hidden(review: ReviewState, hide: bool) -> bool:
    """이번에 처음 숨기는 경우만 작성자에게 알린다 (두 번 숨겨도 알림은 한 번)."""
    return hide and not review.is_hidden
