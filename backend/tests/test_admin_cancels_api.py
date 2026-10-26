# 관리자 취소 요청 API 테스트 — 실제 로컬 DB·실제 HTTP 호출 (conftest.py의 client/login 패턴 그대로)
import uuid
from dataclasses import dataclass

import pytest
from sqlalchemy import delete, select, text

from app.core.db import SessionLocal, engine
from app.models import CancelRequest, Order, OrderItem, OrderStatusHistory, User
from app.models.product import Category, Product
from tests.conftest import headers, login, logout


@dataclass(frozen=True)
class Scenario:
    buyer_email: str
    product_id: int
    order_id: int


@pytest.fixture
async def tag():
    # 로컬 DB가 없거나 마이그레이션 전이면 건너뛴다 (다른 admin_orders 테스트와 같은 방식)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM cancel_requests LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value
    # 이 테스트가 만든 데이터만 지운다
    async with SessionLocal() as session:
        await session.execute(
            delete(CancelRequest).where(
                CancelRequest.order_id.in_(select(Order.id).where(Order.user_id == _buyer_subquery(value)))
            )
        )
        await session.execute(delete(Order).where(Order.user_id == _buyer_subquery(value)))
        await session.execute(delete(User).where(User.email.like(f"admincancels-{value}%@pixelmart.test")))
        # 페이지네이션 테스트는 태그에 꼬리를 붙인(admincancels-{value}0 등) 상품·카테고리도 만들므로 LIKE로 잡는다
        await session.execute(delete(Product).where(Product.category_slug.like(f"admincancels-{value}%")))
        await session.execute(delete(Category).where(Category.slug.like(f"admincancels-{value}%")))
        await session.commit()


def _buyer_subquery(tag: str):
    # 삭제할 때 이 태그로 만든 구매자의 id만 골라내는 작은 서브쿼리
    return select(User.id).where(User.email == f"admincancels-{tag}-buyer@pixelmart.test").scalar_subquery()


async def _make_cancel_scenario(tag: str, *, order_status: str = "cancel_requested") -> tuple[Scenario, int]:
    """구매자 + 상품(재고 10개) + 취소 요청중인 주문 하나 + requested 상태 취소 요청을 만든다"""
    category_slug = f"admincancels-{tag}"
    async with SessionLocal() as session:
        session.add(Category(slug=category_slug, name=f"관리자취소테스트{tag}", description="", sort_order=999))
        buyer = User(email=f"admincancels-{tag}-buyer@pixelmart.test", nickname=f"구매자{tag}", password_hash=None)
        product = Product(
            name=f"관리자 취소 테스트 상품 {tag}",
            stock=10,
            price=5_000,
            category_slug=category_slug,
            image_url="/images/products/test-only.png",
            description="테스트 전용",
            is_new=False,
        )
        session.add_all([buyer, product])
        await session.flush()
        order = Order(
            user_id=buyer.id,
            status=order_status,
            shipping_fee=3_000,
            total_price=13_000,
            recipient_name="홍길동",
            address="서울시 픽셀로 8",
            items=[OrderItem(product_id=product.id, quantity=2, unit_price=5_000)],
            history=[OrderStatusHistory(status=status) for status in ("paid", "preparing", order_status)],
        )
        session.add(order)
        await session.flush()
        request = CancelRequest(order_id=order.id, reason="단순 변심", status="requested")
        session.add(request)
        await session.flush()
        await session.commit()
        scenario = Scenario(buyer.email, product.id, order.id)
        return scenario, request.id


async def admin_token(client, tag: str) -> str:
    token = await login(client, f"admincancels-{tag}-boss@pixelmart.test", f"관리{tag}", admin=True)
    client.cookies.clear()
    return token


async def test_list_returns_nickname_and_total_price(client, tag):
    scenario, request_id = await _make_cancel_scenario(tag)
    token = await admin_token(client, tag)

    res = await client.get("/api/admin/cancel-requests", params={"status": "requested"}, headers=headers(token))
    assert res.status_code == 200
    body = res.json()
    row = next(item for item in body["items"] if item["id"] == request_id)
    assert row["orderId"] == scenario.order_id
    assert row["reason"] == "단순 변심"
    assert row["status"] == "requested"
    assert row["orderStatus"] == "cancel_requested"
    assert row["buyerNickname"] == f"구매자{tag}"
    assert row["totalPrice"] == 13_000


async def test_status_filter_and_pagination(client, tag):
    # requested 요청 3개를 더 만들어 둔다 (총 4개: 위 fixture가 만든 것 포함 안 함 — 이 테스트 자체에서 3개)
    request_ids = []
    for _ in range(3):
        _, request_id = await _make_cancel_scenario(f"{tag}{len(request_ids)}")
        request_ids.append(request_id)
    token = await admin_token(client, tag)

    res = await client.get(
        "/api/admin/cancel-requests", params={"status": "requested", "page": 1, "size": 2}, headers=headers(token)
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 2
    assert body["totalPages"] >= 2

    # approved만 걸러 보면 하나도 안 나온다 (아직 전부 requested)
    approved_only = await client.get(
        "/api/admin/cancel-requests", params={"status": "approved"}, headers=headers(token)
    )
    ids_seen = {item["id"] for item in approved_only.json()["items"]}
    assert not ids_seen & set(request_ids)


async def test_approve_cancels_order_and_restores_stock(client, tag):
    scenario, request_id = await _make_cancel_scenario(tag)
    token = await admin_token(client, tag)

    res = await client.post(f"/api/admin/cancel-requests/{request_id}/approve", headers=headers(token))
    assert res.status_code == 200

    async with SessionLocal() as session:
        order = await session.get(Order, scenario.order_id)
        request = await session.get(CancelRequest, request_id)
        product = await session.get(Product, scenario.product_id)
    assert order.status == "cancelled"
    assert request.status == "approved"
    assert product.stock == 12  # 시작 10개 + 주문 수량 2개 복구


async def test_approve_twice_is_409_and_does_not_restore_stock_again(client, tag):
    scenario, request_id = await _make_cancel_scenario(tag)
    token = await admin_token(client, tag)

    first = await client.post(f"/api/admin/cancel-requests/{request_id}/approve", headers=headers(token))
    assert first.status_code == 200

    second = await client.post(f"/api/admin/cancel-requests/{request_id}/approve", headers=headers(token))
    assert second.status_code == 409

    async with SessionLocal() as session:
        product = await session.get(Product, scenario.product_id)
    assert product.stock == 12  # 두 번째 승인 시도로 재고가 더 늘지 않는다


async def test_reject_restores_previous_status_and_keeps_stock(client, tag):
    scenario, request_id = await _make_cancel_scenario(tag)
    token = await admin_token(client, tag)

    res = await client.post(f"/api/admin/cancel-requests/{request_id}/reject", headers=headers(token))
    assert res.status_code == 200

    async with SessionLocal() as session:
        order = await session.get(Order, scenario.order_id)
        request = await session.get(CancelRequest, request_id)
        product = await session.get(Product, scenario.product_id)
    assert order.status == "preparing"  # cancel_requested 이전 상태로 복귀
    assert request.status == "rejected"
    assert product.stock == 10  # 재고는 건드리지 않는다


async def test_approve_after_reject_is_409(client, tag):
    _, request_id = await _make_cancel_scenario(tag)
    token = await admin_token(client, tag)

    await client.post(f"/api/admin/cancel-requests/{request_id}/reject", headers=headers(token))
    res = await client.post(f"/api/admin/cancel-requests/{request_id}/approve", headers=headers(token))
    assert res.status_code == 409


async def test_unknown_request_id_is_404(client, tag):
    token = await admin_token(client, tag)
    res = await client.post("/api/admin/cancel-requests/999999999/approve", headers=headers(token))
    assert res.status_code == 404


async def test_no_login_is_401(client, tag):
    _, request_id = await _make_cancel_scenario(tag)
    res = await client.post(f"/api/admin/cancel-requests/{request_id}/approve")
    assert res.status_code == 401


async def test_logged_out_token_is_401(client, tag):
    _, request_id = await _make_cancel_scenario(tag)
    token = await admin_token(client, tag)
    await logout(client, token)
    res = await client.post(f"/api/admin/cancel-requests/{request_id}/approve", headers=headers(token))
    assert res.status_code == 401


async def test_non_admin_user_gets_404(client, tag):
    _, request_id = await _make_cancel_scenario(tag)
    token = await login(client, f"admincancels-{tag}-user@pixelmart.test", f"일반{tag}")
    client.cookies.clear()
    res = await client.post(f"/api/admin/cancel-requests/{request_id}/approve", headers=headers(token))
    assert res.status_code == 404
