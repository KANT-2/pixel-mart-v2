from dataclasses import dataclass
from datetime import datetime


class InvalidCoupon(Exception):
    """이 주문에 쓸 수 없는 쿠폰"""


@dataclass(frozen=True)
class CouponTerms:
    discount_type: str  # amount | percent
    discount_value: int
    min_order_price: int
    max_discount: int | None


@dataclass(frozen=True)
class AppliedCoupon:
    user_coupon_id: int
    name: str
    discount: int


def coupon_status(used_at: datetime | None, expires_at: datetime, now: datetime) -> str:
    if used_at is not None:
        return "used"
    return "expired" if expires_at <= now else "available"


def discount_for(terms: CouponTerms, items_price: int) -> int:
    """상품 금액 기준 할인액 — 최소 주문 금액 미달이면 InvalidCoupon, 할인은 상품 금액을 넘지 않는다"""
    if items_price < terms.min_order_price:
        raise InvalidCoupon(f"상품 금액이 {terms.min_order_price:,}원 이상일 때 쓸 수 있는 쿠폰이에요.")
    if terms.discount_type == "percent":
        discount = items_price * terms.discount_value // 100
        if terms.max_discount is not None:
            discount = min(discount, terms.max_discount)
    else:
        discount = terms.discount_value
    return min(discount, items_price)
