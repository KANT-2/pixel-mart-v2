from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Category(Base):
    __tablename__ = "categories"

    slug: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    stock: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    price: Mapped[int] = mapped_column(Integer)

    # 추가 퀘스트: 상품 등급은 가격이 아니라 관리자가 지정
    rarity: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="common",
        server_default="common",
    )

    category_slug: Mapped[str] = mapped_column(
        ForeignKey("categories.slug"),
        index=True,
    )
    image_url: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)

    # 추가 퀘스트: 숨긴 상품은 일반 사용자에게 노출하지 않음
    is_hidden: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    category: Mapped[Category] = relationship(lazy="joined")
