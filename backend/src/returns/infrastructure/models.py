from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ReturnRequest(Base):
    """배송 완료 뒤 반품·교환 신청 — 신청 → 승인 또는 거절"""

    __tablename__ = "return_requests"
    __table_args__ = (
        CheckConstraint("kind IN ('return', 'exchange')", name="kind"),
        CheckConstraint("status IN ('requested', 'approved', 'rejected')", name="status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    reason: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="requested", server_default="requested")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
