# 내 쿠폰 — 목록(웰컴 쿠폰 자동 지급) · 코드 등록
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, status
from pydantic import StringConstraints

from app.schemas.common import CamelModel
from src.common.auth import CurrentUser, DbSession
from src.coupons.domain.rules import coupon_status
from src.coupons.infrastructure.models import UserCoupon
from src.coupons.infrastructure.repositories import CouponRepository

router = APIRouter(prefix="/users/me/coupons", tags=["coupons"])

CouponCode = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class CouponCodeIn(CamelModel):
    code: CouponCode


class UserCouponOut(CamelModel):
    id: int
    name: str
    discount_type: str
    discount_value: int
    min_order_price: int
    max_discount: int | None
    issued_at: datetime
    expires_at: datetime
    status: str  # available | used | expired
    used_order_id: int | None

    @classmethod
    def from_model(cls, row: UserCoupon, now: datetime) -> "UserCouponOut":
        coupon = row.coupon
        return cls(
            id=row.id,
            name=coupon.name,
            discount_type=coupon.discount_type,
            discount_value=coupon.discount_value,
            min_order_price=coupon.min_order_price,
            max_discount=coupon.max_discount,
            issued_at=row.issued_at,
            expires_at=row.expires_at,
            status=coupon_status(row.used_at, row.expires_at, now),
            used_order_id=row.used_order_id,
        )


async def _list(repo: CouponRepository, user_id: int) -> list[UserCouponOut]:
    now = datetime.now(UTC)
    rows = [UserCouponOut.from_model(row, now) for row in await repo.list_for_user(user_id)]
    # 쓸 수 있는 쿠폰 먼저 (그 안에서는 만료가 가까운 순)
    return sorted(rows, key=lambda row: row.status != "available")


@router.get("", response_model=list[UserCouponOut], summary="내 쿠폰 (처음 보면 웰컴 쿠폰 지급)")
async def list_coupons(user: CurrentUser, db: DbSession) -> list[UserCouponOut]:
    repo = CouponRepository(db)
    await repo.issue_welcome(user.id)
    await db.commit()
    return await _list(repo, user.id)


@router.post("", response_model=list[UserCouponOut], status_code=status.HTTP_201_CREATED, summary="쿠폰 코드 등록")
async def register_coupon(body: CouponCodeIn, user: CurrentUser, db: DbSession) -> list[UserCouponOut]:
    repo = CouponRepository(db)
    await repo.register_code(user.id, body.code)  # 없는 코드·이미 받은 쿠폰은 InvalidCoupon(400)
    await db.commit()
    return await _list(repo, user.id)
