from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class BadgeDefinition(Base):
    """관리자가 만드는 이벤트 뱃지 정의."""

    __tablename__ = "badge_defs"

    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(60))
    image: Mapped[str] = mapped_column(String(300))
    rank: Mapped[int] = mapped_column(Integer, default=10, server_default="10")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserBadge(Base):
    """자동·이벤트 뱃지를 받은 시점의 기록."""

    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(30))
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    granted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    memo: Mapped[str | None] = mapped_column(String(200))
