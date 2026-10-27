from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, Field, StringConstraints

from app.models.review import Review
from app.schemas.common import CamelModel, Page
from src.auth.domain.withdrawal import display_nickname

Rating = Annotated[int, Field(ge=1, le=5)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]

PHOTO_PREFIXES = ("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")
MAX_PHOTO_CHARS = 400_000  # 브라우저가 긴 변 800px로 줄여 보내는 사진 한 장 (약 300KB)


def check_photo(value: str) -> str:
    if not value.startswith(PHOTO_PREFIXES):
        raise ValueError("사진은 JPG·PNG·WEBP만 올릴 수 있어요.")
    return value


Photo = Annotated[str, StringConstraints(max_length=MAX_PHOTO_CHARS), AfterValidator(check_photo)]


class ReviewIn(CamelModel):
    rating: Rating
    content: Content
    image_urls: list[Photo] = Field(default_factory=list, max_length=3)  # 포토 리뷰 최대 3장


class ReviewOut(CamelModel):
    """리뷰 한 개 — 작성자는 닉네임만 보인다 (이메일은 내보내지 않는다)"""

    id: int
    product_id: int
    rating: int
    content: str
    nickname: str
    image_urls: list[str] = []
    created_at: datetime
    is_mine: bool = False  # 로그인한 사용자가 쓴 리뷰면 true (삭제 버튼 표시용)

    @classmethod
    def from_model(cls, review: Review, viewer_id: int | None = None) -> "ReviewOut":
        return cls(
            id=review.id,
            product_id=review.product_id,
            rating=review.rating,
            content=review.content,
            nickname=display_nickname(review.user.nickname, review.user.deleted_at),
            image_urls=list(review.image_urls or []),
            created_at=review.created_at,
            is_mine=viewer_id is not None and review.user_id == viewer_id,
        )


class ReviewPage(Page[ReviewOut]):
    """리뷰 목록 + 평균 별점 (리뷰가 없으면 null)"""

    average_rating: float | None
