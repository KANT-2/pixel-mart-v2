from datetime import datetime
from math import ceil
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import StrictBool

from app.deps import AdminUser, DbSession
from app.models import Review
from app.schemas.common import CamelModel, Page
from src.admin_reviews.application.service import AdminReviewService
from src.admin_reviews.infrastructure.repositories import AdminReviewRepository
from src.auth.domain.withdrawal import display_nickname
from src.common.pagination import Pagination

router = APIRouter(prefix="/admin/reviews", tags=["admin"])


class AdminReviewOut(CamelModel):
    """리뷰 + 관리용 정보 (관리자만 보는 작성자 이메일 · 숨김 여부 포함)"""

    id: int
    product_id: int
    product_name: str
    rating: int
    content: str
    image_urls: list[str]
    nickname: str
    author_email: str
    is_hidden: bool
    created_at: datetime


class AdminReviewHiddenIn(CamelModel):
    hidden: StrictBool  # "yes" 같은 문자열로 잘못 숨기지 않게 true/false만


def _out(review: Review, product_name: str) -> AdminReviewOut:
    withdrawn = review.user.deleted_at is not None
    return AdminReviewOut(
        id=review.id,
        product_id=review.product_id,
        product_name=product_name,
        rating=review.rating,
        content=review.content,
        image_urls=list(review.image_urls or []),
        nickname=display_nickname(review.user.nickname, review.user.deleted_at),
        author_email="탈퇴한 계정" if withdrawn else review.user.email,
        is_hidden=review.is_hidden,
        created_at=review.created_at,
    )


@router.get("", response_model=Page[AdminReviewOut], summary="[관리자] 리뷰 목록 (숨김 · 별점 · 사진 · 검색)")
async def list_reviews(
    _admin: AdminUser,
    db: DbSession,
    pagination: Pagination,
    hidden: bool | None = None,
    rating: Annotated[int | None, Query(ge=1, le=5)] = None,
    photo: bool | None = None,
    q: Annotated[str | None, Query(max_length=100, description="상품 이름 · 내용 · 닉네임 · 이메일")] = None,
):
    keyword = q.strip() if q and q.strip() else None
    rows, total = await AdminReviewRepository(db).search(
        hidden, rating, photo, keyword, (pagination.page - 1) * pagination.size, pagination.size
    )
    return Page[AdminReviewOut](
        items=[_out(review, name) for review, name in rows],
        total=total,
        page=pagination.page,
        size=pagination.size,
        total_pages=max(1, ceil(total / pagination.size)),
    )


@router.patch("/{review_id}", response_model=AdminReviewOut, summary="[관리자] 리뷰 숨김 · 다시 보이기")
async def change_review_hidden(review_id: int, body: AdminReviewHiddenIn, _admin: AdminUser, db: DbSession):
    repo = AdminReviewRepository(db)
    await AdminReviewService(repo, db).set_hidden(review_id, body.hidden)
    return _out(*(await repo.get(review_id)))
