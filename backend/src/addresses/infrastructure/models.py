from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, false, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ShippingAddress(Base):
    """내 배송지 — 주문서에서 불러 쓰고, 기본 배송지는 한 사람에 하나"""

    __tablename__ = "shipping_addresses"
    __table_args__ = (
        Index("uq_shipping_addresses_default", "user_id", unique=True, postgresql_where=text("is_default")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(20))
    recipient_name: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(20))
    postal_code: Mapped[str] = mapped_column(String(10))
    address: Mapped[str] = mapped_column(String(200))
    address_detail: Mapped[str] = mapped_column(String(100), default="", server_default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
