from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.product import Product

# 결제 승인과 함께 주문이 만들어지므로 paid(주문 완료)로 시작한다
ORDER_STATUSES = (
    "paid",
    "preparing",
    "shipping",
    "delivered",
    "cancel_requested",
    "cancelled",
    "return_requested",
    "returned",
    "exchange_requested",
)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="paid")
    shipping_fee: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    points_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_price: Mapped[int] = mapped_column(Integer)  # 원 단위
    recipient_name: Mapped[str] = mapped_column(String(50))
    address: Mapped[str] = mapped_column(String(200))
    # 배송지 상세 — 이전 주문은 빈 값
    phone: Mapped[str] = mapped_column(String(20), default="", server_default="")
    postal_code: Mapped[str] = mapped_column(String(10), default="", server_default="")
    address_detail: Mapped[str] = mapped_column(String(100), default="", server_default="")
    delivery_memo: Mapped[str] = mapped_column(String(100), default="", server_default="")
    payment_method: Mapped[str] = mapped_column(String(20), default="card", server_default="card")
    # 쿠폰 할인 (주문 시점 이름·금액을 그대로 남긴다)
    coupon_discount: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    coupon_name: Mapped[str | None] = mapped_column(String(50))
    # 배송중으로 넘길 때 관리자가 입력하는 택배사 · 운송장
    courier: Mapped[str | None] = mapped_column(String(20))
    tracking_number: Mapped[str | None] = mapped_column(String(30))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 구매 확정
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", order_by="OrderItem.id", lazy="selectin", cascade="all, delete-orphan"
    )
    history: Mapped[list["OrderStatusHistory"]] = relationship(
        back_populates="order", order_by="OrderStatusHistory.id", lazy="selectin", cascade="all, delete-orphan"
    )
    # 반품·교환 신청 (src/returns) — 주문 상세에서 최근 신청만 읽는다
    return_requests: Mapped[list["ReturnRequest"]] = relationship(  # noqa: F821
        order_by="ReturnRequest.id", lazy="selectin", viewonly=True
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity BETWEEN 1 AND 99", name="quantity_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(Integer)  # 주문 시점 가격 (상품 가격이 바뀌어도 유지)

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(lazy="joined")


class OrderStatusHistory(Base):
    """배송 조회 타임라인 — 상태가 바뀔 때마다 한 줄씩 쌓는다"""

    __tablename__ = "order_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped[Order] = relationship(back_populates="history")
