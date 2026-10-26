# 관리자 주문 서비스 테스트 — 실제 로컬 DB를 쓴다 (test_orders_service.py와 같은 방식)
import uuid
from dataclasses import dataclass

import pytest
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models import CancelRequest, Notification, Order, OrderItem, OrderStatusHistory, User
from app.models.product import Category, Product
from src.admin_orders.application.service import AdminOrderService
from src.admin_orders.domain.exceptions import AlreadyResolved, InvalidTransition
from src.admin_orders.infrastructure.repositories import AdminOrderRepository


@dataclass(frozen=True)
class Scenario:
    user_id: int
    product_id: int
    order_id: int


async def _make_scenario(sessions, tag: str, *, order_status: str, history: list[str]) -> Scenario:
    # 테스트용 사용자·상품·주문·타임라인을 만든다 (재고는 10개로 시작)
    category_slug = f"admin-orders-{tag}"
    async with sessions() as session:
        session.add(Category(slug=category_slug, name=f"관리자주문테스트{tag}", description="", sort_order=999))
        user = User(email=f"admin-orders-{tag}@pixelmart.test", nickname=f"구매자{tag}", password_hash=None)
        product = Product(
            name=f"관리자 주문 테스트 상품 {tag}",
            stock=10,
            price=5_000,
            category_slug=category_slug,
            image_url="/images/products/test-only.png",
            description="테스트 전용",
            is_new=False,
        )
        session.add_all([user, product])
        await session.flush()
        order = Order(
            user_id=user.id,
            status=order_status,
            shipping_fee=3_000,
            total_price=13_000,
            recipient_name="홍길동",
            address="서울시 픽셀로 8",
            items=[OrderItem(product_id=product.id, quantity=2, unit_price=5_000)],
            history=[OrderStatusHistory(status=status) for status in history],
        )
        session.add(order)
        await session.flush()
        await session.commit()
        return Scenario(user.id, product.id, order.id)


async def _cleanup(sessions, scenario: Scenario, tag: str) -> None:
    async with sessions() as session:
        await session.execute(delete(CancelRequest).where(CancelRequest.order_id == scenario.order_id))
        await session.execute(delete(Order).where(Order.id == scenario.order_id))
        await session.execute(delete(User).where(User.id == scenario.user_id))
        await session.execute(delete(Product).where(Product.id == scenario.product_id))
        await session.execute(delete(Category).where(Category.slug == f"admin-orders-{tag}"))
        await session.commit()


@pytest.fixture
async def db_sessions():
    # 로컬 DB가 없거나 마이그레이션 전이면 건너뛴다 (test_orders_service.py와 같은 방식)
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT stock FROM products LIMIT 1"))
    except Exception:
        await engine.dispose()
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    yield sessions
    await engine.dispose()


def service_for(session) -> AdminOrderService:
    # 레포지토리 + 세션(트랜잭션 역할)을 묶어 서비스를 만든다
    return AdminOrderService(AdminOrderRepository(session), session)


async def test_advance_order_changes_status_history_and_notifies(db_sessions):
    tag = uuid.uuid4().hex[:8]
    scenario = await _make_scenario(db_sessions, tag, order_status="paid", history=["paid"])
    try:
        async with db_sessions() as session:
            new_status = await service_for(session).advance_order(scenario.order_id)
        assert new_status == "preparing"

        async with db_sessions() as session:
            order = await session.get(Order, scenario.order_id)
            history = list(
                await session.scalars(
                    select(OrderStatusHistory.status)
                    .where(OrderStatusHistory.order_id == scenario.order_id)
                    .order_by(OrderStatusHistory.id)
                )
            )
            preparing_ref_key = f"order:{scenario.order_id}:preparing"
            notification_count = await session.scalar(
                select(Notification).where(
                    Notification.user_id == scenario.user_id, Notification.ref_key == preparing_ref_key
                )
            )
        assert order.status == "preparing"
        assert history == ["paid", "preparing"]
        assert notification_count is not None
    finally:
        await _cleanup(db_sessions, scenario, tag)


async def test_advance_order_from_delivered_raises_and_keeps_state(db_sessions):
    tag = uuid.uuid4().hex[:8]
    full_history = ["paid", "preparing", "shipping", "delivered"]
    scenario = await _make_scenario(db_sessions, tag, order_status="delivered", history=full_history)
    try:
        async with db_sessions() as session:
            with pytest.raises(InvalidTransition):
                await service_for(session).advance_order(scenario.order_id)

        async with db_sessions() as session:
            order = await session.get(Order, scenario.order_id)
            history = list(
                await session.scalars(
                    select(OrderStatusHistory.status)
                    .where(OrderStatusHistory.order_id == scenario.order_id)
                    .order_by(OrderStatusHistory.id)
                )
            )
            ref_key_pattern = "order:%"
            notification_exists = await session.scalar(
                select(Notification).where(
                    Notification.user_id == scenario.user_id, Notification.ref_key.like(ref_key_pattern)
                )
            )
        assert order.status == "delivered"
        assert history == full_history
        assert notification_exists is None
    finally:
        await _cleanup(db_sessions, scenario, tag)


async def _make_cancel_scenario(db_sessions, tag: str) -> tuple[Scenario, int]:
    # cancel_requested 상태의 주문 + requested 상태의 취소 요청을 만든다
    pre_cancel_history = ["paid", "preparing", "cancel_requested"]
    scenario = await _make_scenario(db_sessions, tag, order_status="cancel_requested", history=pre_cancel_history)
    async with db_sessions() as session:
        request = CancelRequest(order_id=scenario.order_id, reason="단순 변심", status="requested")
        session.add(request)
        await session.flush()
        await session.commit()
        request_id = request.id
    return scenario, request_id


async def test_approve_cancel_cancels_order_restores_stock_and_notifies(db_sessions):
    tag = uuid.uuid4().hex[:8]
    scenario, request_id = await _make_cancel_scenario(db_sessions, tag)
    try:
        async with db_sessions() as session:
            await service_for(session).approve_cancel(request_id)

        async with db_sessions() as session:
            order = await session.get(Order, scenario.order_id)
            request = await session.get(CancelRequest, request_id)
            product = await session.get(Product, scenario.product_id)
            approved_ref_key = f"cancel:{request_id}:approved"
            notification_count = len(
                list(
                    await session.scalars(
                        select(Notification).where(
                            Notification.user_id == scenario.user_id, Notification.ref_key == approved_ref_key
                        )
                    )
                )
            )
        assert order.status == "cancelled"
        assert request.status == "approved"
        assert product.stock == 12  # 시작 10개 + 주문 수량 2개 복구
        assert notification_count == 1
    finally:
        await _cleanup(db_sessions, scenario, tag)


async def test_approve_cancel_rolls_back_everything_when_notify_fails(db_sessions, monkeypatch):
    tag = uuid.uuid4().hex[:8]
    scenario, request_id = await _make_cancel_scenario(db_sessions, tag)
    try:
        async def boom(*args, **kwargs):
            raise RuntimeError("알림 서버가 잠깐 멈췄다고 가정한다")

        # 알림 단계에서만 실패하게 만들어, 그 앞까지의 변경(재고 복구 포함)이 전부 롤백되는지 확인한다
        monkeypatch.setattr("src.admin_orders.infrastructure.repositories.notifications.notify", boom)

        async with db_sessions() as session:
            with pytest.raises(RuntimeError):
                await service_for(session).approve_cancel(request_id)

        async with db_sessions() as session:
            order = await session.get(Order, scenario.order_id)
            request = await session.get(CancelRequest, request_id)
            product = await session.get(Product, scenario.product_id)
        assert order.status == "cancel_requested"  # 주문 상태가 그대로
        assert request.status == "requested"  # 요청 상태가 그대로
        assert product.stock == 10  # 재고가 복구되지 않은 채 그대로
    finally:
        await _cleanup(db_sessions, scenario, tag)


async def test_approve_cancel_twice_raises_already_resolved_without_double_restore(db_sessions):
    tag = uuid.uuid4().hex[:8]
    scenario, request_id = await _make_cancel_scenario(db_sessions, tag)
    try:
        async with db_sessions() as session:
            await service_for(session).approve_cancel(request_id)

        async with db_sessions() as session:
            with pytest.raises(AlreadyResolved):
                await service_for(session).approve_cancel(request_id)

        async with db_sessions() as session:
            product = await session.get(Product, scenario.product_id)
        assert product.stock == 12  # 두 번째 승인 시도로 재고가 더 늘지 않는다
    finally:
        await _cleanup(db_sessions, scenario, tag)


async def test_reject_cancel_restores_previous_status_keeps_stock_and_notifies(db_sessions):
    tag = uuid.uuid4().hex[:8]
    scenario, request_id = await _make_cancel_scenario(db_sessions, tag)
    try:
        async with db_sessions() as session:
            await service_for(session).reject_cancel(request_id)

        async with db_sessions() as session:
            order = await session.get(Order, scenario.order_id)
            request = await session.get(CancelRequest, request_id)
            product = await session.get(Product, scenario.product_id)
            rejected_ref_key = f"cancel:{request_id}:rejected"
            notification_count = len(
                list(
                    await session.scalars(
                        select(Notification).where(
                            Notification.user_id == scenario.user_id, Notification.ref_key == rejected_ref_key
                        )
                    )
                )
            )
        assert order.status == "preparing"  # 신청 직전 상태(cancel_requested 이전)로 복귀
        assert request.status == "rejected"
        assert product.stock == 10  # 재고는 건드리지 않는다
        assert notification_count == 1

        # 거절 뒤에 다시 승인하려 하면 이미 처리된 요청이다
        async with db_sessions() as session:
            with pytest.raises(AlreadyResolved):
                await service_for(session).approve_cancel(request_id)
    finally:
        await _cleanup(db_sessions, scenario, tag)
