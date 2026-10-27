from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.coupons.domain.rules import AppliedCoupon, CouponTerms, InvalidCoupon, coupon_status, discount_for
from src.coupons.infrastructure.models import Coupon, UserCoupon


def terms_of(coupon: Coupon) -> CouponTerms:
    return CouponTerms(coupon.discount_type, coupon.discount_value, coupon.min_order_price, coupon.max_discount)


class CouponRepository:
    """쿠폰 지급·사용·되돌리기. commit은 호출한 쪽이 한다"""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _issue(self, user_id: int, coupon: Coupon) -> bool:
        # 같은 쿠폰은 한 사람에 한 장 — 이미 있으면 아무것도 하지 않는다
        result = await self.session.execute(
            insert(UserCoupon)
            .values(
                user_id=user_id, coupon_id=coupon.id, expires_at=datetime.now(UTC) + timedelta(days=coupon.valid_days)
            )
            .on_conflict_do_nothing(index_elements=["user_id", "coupon_id"])
        )
        return result.rowcount == 1

    async def issue_welcome(self, user_id: int) -> None:
        """회원이면 누구나 받는 쿠폰 — 내 쿠폰을 처음 볼 때 지급한다"""
        coupons = await self.session.scalars(
            select(Coupon).where(Coupon.auto_issue == "welcome", Coupon.is_active.is_(True))
        )
        for coupon in coupons:
            await self._issue(user_id, coupon)

    async def register_code(self, user_id: int, code: str) -> None:
        coupon = await self.session.scalar(
            select(Coupon).where(Coupon.code == code.strip().upper(), Coupon.is_active.is_(True))
        )
        if coupon is None:
            raise InvalidCoupon("없는 쿠폰 코드예요.")
        if not await self._issue(user_id, coupon):
            raise InvalidCoupon("이미 받은 쿠폰이에요.")

    async def list_for_user(self, user_id: int) -> list[UserCoupon]:
        rows = await self.session.scalars(
            select(UserCoupon).where(UserCoupon.user_id == user_id).order_by(UserCoupon.expires_at, UserCoupon.id)
        )
        return list(rows)

    async def reserve(self, user_id: int, user_coupon_id: int, items_price: int) -> AppliedCoupon:
        """주문에 쓸 쿠폰을 잠그고 할인액을 계산한다 (사용 표시는 주문 번호가 생긴 뒤 mark_used)"""
        row = await self.session.scalar(
            select(UserCoupon)
            .where(UserCoupon.id == user_coupon_id, UserCoupon.user_id == user_id)
            .with_for_update(of=UserCoupon)
        )
        if row is None:
            raise InvalidCoupon("쿠폰을 찾을 수 없어요.")
        state = coupon_status(row.used_at, row.expires_at, datetime.now(UTC))
        if state == "used":
            raise InvalidCoupon("이미 사용한 쿠폰이에요.")
        if state == "expired":
            raise InvalidCoupon("기간이 지난 쿠폰이에요.")
        return AppliedCoupon(row.id, row.coupon.name, discount_for(terms_of(row.coupon), items_price))

    async def mark_used(self, user_coupon_id: int, order_id: int) -> None:
        await self.session.execute(
            update(UserCoupon)
            .where(UserCoupon.id == user_coupon_id)
            .values(used_order_id=order_id, used_at=datetime.now(UTC))
        )

    async def release_for_order(self, order_id: int) -> None:
        """주문이 취소·반품되면 쓴 쿠폰을 돌려준다 (기간이 지났으면 돌려받아도 만료로 보인다)"""
        await self.session.execute(
            update(UserCoupon).where(UserCoupon.used_order_id == order_id).values(used_order_id=None, used_at=None)
        )
