import uuid
from dataclasses import dataclass

import pytest
from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.cart import CartItem
from app.models.order import Order, OrderItem
from app.models.product import Category, Product
from app.models.user import User
from src.orders.application.service import OrderService
from src.orders.domain.exceptions import EmptyCart, OutOfStock
from src.orders.infrastructure.repositories import OrderRepository


@dataclass(frozen=True)
class Scenario:
    user_id: int
    product_ids: tuple[int, int]


@pytest.fixture
async def order_db():
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT stock FROM products LIMIT 1"))
    except Exception:
        await engine.dispose()
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")

    sessions = async_sessionmaker(engine, expire_on_commit=False)
    tag = uuid.uuid4().hex[:8]
    category_slug = f"orders-{tag}"
    async with sessions() as session:
        session.add(Category(slug=category_slug, name=f"주문테스트{tag}", description="", sort_order=999))
        user = User(email=f"orders-service-{tag}@pixelmart.test", nickname=f"기사{tag}", password_hash=None)
        products = [
            Product(
                name=f"주문 서비스 상품 A {tag}",
                stock=5,
                price=12_000,
                category_slug=category_slug,
                image_url="/images/products/test-only.png",
                description="테스트 전용",
                is_new=False,
            ),
            Product(
                name=f"주문 서비스 상품 B {tag}",
                stock=3,
                price=4_000,
                category_slug=category_slug,
                image_url="/images/products/test-only.png",
                description="테스트 전용",
                is_new=False,
            ),
        ]
        session.add_all([user, *products])
        await session.flush()
        session.add_all(
            [
                CartItem(user_id=user.id, product_id=products[0].id, quantity=2),
                CartItem(user_id=user.id, product_id=products[1].id, quantity=1),
            ]
        )
        await session.commit()
        scenario = Scenario(user.id, (products[0].id, products[1].id))

    yield sessions, scenario

    async with sessions() as session:
        await session.execute(delete(Order).where(Order.user_id == scenario.user_id))
        await session.execute(delete(CartItem).where(CartItem.user_id == scenario.user_id))
        await session.execute(delete(User).where(User.id == scenario.user_id))
        await session.execute(delete(Product).where(Product.id.in_(scenario.product_ids)))
        await session.execute(delete(Category).where(Category.slug == category_slug))
        await session.commit()
    await engine.dispose()


def service_for(session):
    return OrderService(OrderRepository(session), session)


async def test_success_decreases_stock_creates_order_and_clears_cart(order_db):
    sessions, scenario = order_db
    async with sessions() as session:
        order_id = await service_for(session).place_order(scenario.user_id, "홍길동", "서울시 픽셀로 8")

    async with sessions() as session:
        order = await session.get(Order, order_id)
        stocks = list(
            await session.scalars(
                select(Product.stock).where(Product.id.in_(scenario.product_ids)).order_by(Product.id)
            )
        )
        cart = list(await session.scalars(select(CartItem).where(CartItem.user_id == scenario.user_id)))
        items = list(
            await session.scalars(select(OrderItem).where(OrderItem.order_id == order_id).order_by(OrderItem.id))
        )

    assert stocks == [3, 2]
    assert cart == []
    assert order is not None
    assert (order.shipping_fee, order.total_price) == (3_000, 31_000)
    assert [(item.product_id, item.quantity, item.unit_price) for item in items] == [
        (scenario.product_ids[0], 2, 12_000),
        (scenario.product_ids[1], 1, 4_000),
    ]


async def test_out_of_stock_rolls_back_order_other_stock_and_cart(order_db):
    sessions, scenario = order_db
    async with sessions() as session:
        await session.execute(update(Product).where(Product.id == scenario.product_ids[1]).values(stock=0))
        await session.commit()

    async with sessions() as session:
        with pytest.raises(OutOfStock, match="품절된 상품이에요."):
            await service_for(session).place_order(scenario.user_id, "홍길동", "서울시 픽셀로 8")

    async with sessions() as session:
        stocks = list(
            await session.scalars(
                select(Product.stock).where(Product.id.in_(scenario.product_ids)).order_by(Product.id)
            )
        )
        cart_quantities = list(
            await session.scalars(
                select(CartItem.quantity).where(CartItem.user_id == scenario.user_id).order_by(CartItem.product_id)
            )
        )
        orders = list(await session.scalars(select(Order).where(Order.user_id == scenario.user_id)))

    assert stocks == [5, 0]
    assert cart_quantities == [2, 1]
    assert orders == []


async def test_empty_cart_rolls_back_and_uses_contract_message(order_db):
    sessions, scenario = order_db
    async with sessions() as session:
        await session.execute(delete(CartItem).where(CartItem.user_id == scenario.user_id))
        await session.commit()
        with pytest.raises(EmptyCart, match="장바구니가 비어 있어요."):
            await service_for(session).place_order(scenario.user_id, "홍길동", "서울시 픽셀로 8")
