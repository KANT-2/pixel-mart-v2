from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TradePost, User
from app.services import notifications
from app.services.search import LIKE_ESCAPE, like_pattern
from src.admin_trades.domain.moderation import TradeState


class AdminTradeRepository:
    """관리자 거래글 관리. 샘플 글(is_sample)은 다루지 않는다. commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def search(
        self, status: str | None, kind: str | None, q: str | None, offset: int, limit: int
    ) -> tuple[list[TradePost], int]:
        conditions = [TradePost.is_sample.is_(False)]
        if status:
            conditions.append(TradePost.status == status)
        if kind:
            conditions.append(TradePost.kind == kind)
        if q:
            pattern = like_pattern(q)
            conditions.append(
                or_(
                    TradePost.item_name.ilike(pattern, escape=LIKE_ESCAPE),
                    TradePost.content.ilike(pattern, escape=LIKE_ESCAPE),
                    User.nickname.ilike(pattern, escape=LIKE_ESCAPE),
                    User.email.ilike(pattern, escape=LIKE_ESCAPE),
                )
            )
        ids = select(TradePost.id).join(User, TradePost.user_id == User.id).where(*conditions)
        total = await self.session.scalar(select(func.count()).select_from(ids.subquery()))
        rows = await self.session.scalars(
            select(TradePost)
            .where(TradePost.id.in_(ids))
            .order_by(TradePost.created_at.desc(), TradePost.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(rows.unique()), total or 0

    async def state(self, post_id: int) -> TradeState | None:
        post = await self.session.get(TradePost, post_id)
        if post is None or post.is_sample:
            return None
        return TradeState(post.id, post.user_id, post.status, post.hidden_by_admin)

    async def set_state(self, post_id: int, status: str, hidden_by_admin: bool) -> None:
        await self.session.execute(
            update(TradePost).where(TradePost.id == post_id).values(status=status, hidden_by_admin=hidden_by_admin)
        )

    async def notify_hidden(self, post: TradeState) -> None:
        """글쓴이에게 알림 (ADMIN_API.md 8장 — 같은 글은 한 번만)"""
        await notifications.notify(
            self.session,
            post.owner_id,
            "trade_hidden",
            "거래글이 운영 정책으로 숨겨졌어요",
            "운영 정책에 맞지 않아 다른 이웃에게 보이지 않게 했어요.",
            "/local/trades/mine",
            f"trade-hidden:{post.id}",
        )

    async def get(self, post_id: int) -> TradePost:
        return await self.session.get(TradePost, post_id, populate_existing=True)
