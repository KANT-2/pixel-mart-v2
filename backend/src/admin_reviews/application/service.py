from typing import Protocol

from src.admin_reviews.domain.moderation import ReviewNotFound, ReviewState, newly_hidden


class AdminReviews(Protocol):
    async def state(self, review_id: int) -> ReviewState | None: ...
    async def set_hidden(self, review_id: int, hidden: bool) -> None: ...
    async def notify_hidden(self, review: ReviewState) -> None: ...
    async def set_reply(self, review_id: int, reply: str | None) -> None: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class AdminReviewService:
    def __init__(self, reviews: AdminReviews, tx: Transaction) -> None:
        self.reviews = reviews
        self.tx = tx

    async def set_hidden(self, review_id: int, hidden: bool) -> None:
        review = await self.reviews.state(review_id)
        if review is None:
            raise ReviewNotFound()
        try:
            await self.reviews.set_hidden(review_id, hidden)
            if newly_hidden(review, hidden):
                await self.reviews.notify_hidden(review)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise

    async def set_reply(self, review_id: int, reply: str | None) -> None:
        if await self.reviews.state(review_id) is None:
            raise ReviewNotFound()
        try:
            await self.reviews.set_reply(review_id, reply)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
