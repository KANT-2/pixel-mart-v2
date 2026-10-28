from datetime import UTC, datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Product, Review, User
from app.services import notifications
from app.services.search import LIKE_ESCAPE, like_pattern
from src.admin_reviews.domain.moderation import ReviewState


class AdminReviewRepository:
    """관리자 리뷰 관리. commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def search(
        self, hidden: bool | None, rating: int | None, photo: bool | None, q: str | None, offset: int, limit: int
    ) -> tuple[list[tuple[Review, str]], int]:
        conditions = []
        if hidden is not None:
            conditions.append(Review.is_hidden.is_(hidden))
        if rating is not None:
            conditions.append(Review.rating == rating)
        if photo is not None:
            has_photo = func.json_array_length(Review.image_urls) > 0
            conditions.append(has_photo if photo else ~has_photo)
        if q:
            pattern = like_pattern(q)
            conditions.append(
                or_(
                    Product.name.ilike(pattern, escape=LIKE_ESCAPE),
                    Review.content.ilike(pattern, escape=LIKE_ESCAPE),
                    User.nickname.ilike(pattern, escape=LIKE_ESCAPE),
                    User.email.ilike(pattern, escape=LIKE_ESCAPE),
                )
            )
        base = (
            select(Review, Product.name)
            .join(Product, Review.product_id == Product.id)
            .join(User, Review.user_id == User.id)
            .where(*conditions)
        )
        total = await self.session.scalar(
            select(func.count()).select_from(base.with_only_columns(Review.id).subquery())
        )
        rows = await self.session.execute(
            base.order_by(Review.created_at.desc(), Review.id.desc()).offset(offset).limit(limit)
        )
        return [(review, name) for review, name in rows.unique().all()], total or 0

    async def state(self, review_id: int) -> ReviewState | None:
        review = await self.session.get(Review, review_id)
        if review is None:
            return None
        return ReviewState(review.id, review.user_id, review.product_id, review.is_hidden)

    async def set_hidden(self, review_id: int, hidden: bool) -> None:
        await self.session.execute(update(Review).where(Review.id == review_id).values(is_hidden=hidden))

    async def set_reply(self, review_id: int, reply: str | None) -> None:
        await self.session.execute(
            update(Review)
            .where(Review.id == review_id)
            .values(
                reply=reply,
                replied_at=datetime.now(UTC) if reply is not None else None,
            )
        )

    async def notify_hidden(self, review: ReviewState) -> None:
        """작성자에게 알림 — 같은 리뷰는 한 번만"""
        await notifications.notify(
            self.session,
            review.writer_id,
            "review_hidden",
            "리뷰가 운영 정책으로 숨겨졌어요",
            "운영 정책에 맞지 않아 다른 사람에게 보이지 않게 했어요.",
            f"/products/{review.product_id}",
            f"review-hidden:{review.id}",
        )

    async def get(self, review_id: int) -> tuple[Review, str]:
        review = await self.session.get(Review, review_id, populate_existing=True)
        name = await self.session.scalar(select(Product.name).where(Product.id == review.product_id))
        return review, name or ""
