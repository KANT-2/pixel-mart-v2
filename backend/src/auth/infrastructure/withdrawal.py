from datetime import datetime

from sqlalchemy import delete, false, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ActivityPoint,
    CartItem,
    Gift,
    Notification,
    Order,
    TradePost,
    TradeRequest,
    User,
    UserBadge,
    UserInterest,
    Wishlist,
)
from src.auth.domain.withdrawal import ACTIVE_ORDER_STATUSES, WithdrawTarget, withdrawn_email, withdrawn_nickname


class WithdrawRepository:
    """탈퇴 때 지우거나 익명으로 바꿀 데이터 (ADMIN_API.md 5-1장 표). commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def target(self, user_id: int) -> WithdrawTarget | None:
        user = await self.session.get(User, user_id)
        if user is None:
            return None
        active = await self.session.scalar(
            select(func.count())
            .select_from(Order)
            .where(Order.user_id == user_id, Order.status.in_(ACTIVE_ORDER_STATUSES))
        )
        return WithdrawTarget(id=user.id, role=user.role, deleted_at=user.deleted_at, active_orders=active or 0)

    async def clean_up(self, user_id: int) -> None:
        # 지워요: 장바구니 · 찜 · 알림 · 취향 · 활동 점수 · 뱃지
        for model in (CartItem, Wishlist, Notification, UserInterest, ActivityPoint, UserBadge):
            await self.session.execute(delete(model).where(model.user_id == user_id))
        # 자동 처리: 내 거래글 숨김 · 대기 중 교환 신청 취소 · 대기 중 선물 거절
        await self.session.execute(
            update(TradePost).where(TradePost.user_id == user_id, TradePost.status != "hidden").values(status="hidden")
        )
        my_posts = select(TradePost.id).where(TradePost.user_id == user_id)
        await self.session.execute(
            update(TradeRequest)
            .where(
                TradeRequest.status == "pending",
                or_(TradeRequest.requester_id == user_id, TradeRequest.post_id.in_(my_posts)),
            )
            .values(status="cancelled")
        )
        await self.session.execute(
            update(Gift)
            .where(Gift.status == "pending", or_(Gift.sender_id == user_id, Gift.recipient_id == user_id))
            .values(status="declined")
        )

    async def anonymize(self, user_id: int, now: datetime) -> None:
        # 남기되 익명으로: 주문 · 리뷰 · 문의는 그대로 두고, 계정의 개인정보만 지운다
        await self.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                email=withdrawn_email(user_id),
                nickname=withdrawn_nickname(user_id),
                password_hash=None,
                google_sub=None,
                avatar_url=None,
                featured_badge=None,
                region_code=None,
                fandom_opt_in=false(),
                profile_public=false(),
                map_avatar_opt_in=false(),
                nickname_public=false(),
                map_card_public=false(),
                deleted_at=now,
            )
        )
