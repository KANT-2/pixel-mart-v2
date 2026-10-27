from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Coupon(Base):
    """쿠폰 종류 — 정액(amount) 또는 정률(percent). code가 있으면 코드로 등록, auto_issue가 있으면 자동 지급"""

    __tablename__ = "coupons"
    __table_args__ = (
        CheckConstraint("discount_type IN ('amount', 'percent')", name="discount_type"),
        CheckConstraint("discount_value > 0", name="discount_value_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str | None] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(50))
    discount_type: Mapped[str] = mapped_column(String(10))
    discount_value: Mapped[int] = mapped_column(Integer)
    min_order_price: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    max_discount: Mapped[int | None] = mapped_column(Integer)
    valid_days: Mapped[int] = mapped_column(Integer)
    auto_issue: Mapped[str | None] = mapped_column(String(20))  # "welcome" = 회원이면 누구나 한 장
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class UserCoupon(Base):
    """내 쿠폰 — 쿠폰 종류마다 한 사람에 한 장. 주문에 쓰면 used_order_id가 채워진다"""

    __tablename__ = "user_coupons"
    __table_args__ = (UniqueConstraint("user_id", "coupon_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    coupon_id: Mapped[int] = mapped_column(ForeignKey("coupons.id", ondelete="CASCADE"))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    coupon: Mapped[Coupon] = relationship(lazy="joined")
