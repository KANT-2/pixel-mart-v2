# 관리자 주문 API 테스트 — 실제 로컬 DB·실제 HTTP 호출 (test_admin_cancels_api.py와 같은 패턴)
import uuid
from dataclasses import dataclass

import pytest
from sqlalchemy import delete, text

from app.core.db import SessionLocal, engine
from app.models import Order, OrderItem, OrderStatusHistory, User
from app.models.product import Category, Product
from tests.conftest import headers, login, logout


@dataclass(frozen=True)
class Scenario:
    buyer_email: str
    buyer_nickname: str
    product_id: int
    order_id: int


@pytest.fixture
async def tag():
    # 로컬 DB가 없거나 마이그레이션 전이면 건너뛴다 (다른 admin_orders 테스트와 같은 방식)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM orders LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value
    # 이 테스트가 만든 데이터만 지운다 (주문·품목·이력은 User 삭제 시 CASCADE로 같이 지워진다)
    async with SessionLocal() as session:
        await session.execute(delete(User).where(User.email.like(f"adminorders-{value}%@pixelmart.test")))
        # 페이지네이션 테스트는 태그에 꼬리를 붙인(adminorders-{value}0 등) 상품·카테고리도 만들므로 LIKE로 잡는다
        await session.execute(delete(Product).where(Product.category_slug.like(f"adminorders-{value}%")))
        await session.execute(delete(Category).where(Category.slug.like(f"adminorders-{value}%")))
        await session.commit()


async def _make_order_scenario(tag: str, *, order_status: str = "paid", nickname: str | None = None) -> Scenario:
    """구매자 + 상품(재고 10개) + 주문 하나(품목 1개)를 만든다"""
    category_slug = f"adminorders-{tag}"
    buyer_nickname = nickname or f"구매자{tag}"
    async with SessionLocal() as session:
        session.add(Category(slug=category_slug, name=f"관리자주문테스트{tag}", description="", sort_order=999))
        buyer_email = f"adminorders-{tag}-buyer@pixelmart.test"
        buyer = User(email=buyer_email, nickname=buyer_nickname, password_hash=None)
        product = Product(
            name=f"관리자 주문 테스트 상품 {tag}",
            stock=10,
            price=5_000,
            category_slug=category_slug,
            image_url="/images/products/test-only.png",
            description="테스트 전용",
            is_new=False,
        )
        session.add_all([buyer, product])
        await session.flush()
        history_statuses = {
            "paid": ["paid"],
            "preparing": ["paid", "preparing"],
            "delivered": ["paid", "preparing", "shipping", "delivered"],
            "cancel_requested": ["paid", "preparing", "cancel_requested"],
        }[order_status]
        order = Order(
            user_id=buyer.id,
            status=order_status,
            shipping_fee=3_000,
            total_price=13_000,
            recipient_name="홍길동",
            address="서울시 픽셀로 8",
            items=[OrderItem(product_id=product.id, quantity=2, unit_price=5_000)],
            history=[OrderStatusHistory(status=status) for status in history_statuses],
        )
        session.add(order)
        await session.flush()
        await session.commit()
        return Scenario(buyer_email, buyer_nickname, product.id, order.id)


async def admin_token(client, tag: str) -> str:
    token = await login(client, f"adminorders-{tag}-boss@pixelmart.test", f"관리{tag}", admin=True)
    client.cookies.clear()
    return token


async def test_list_includes_nickname_email_and_no_address(client, tag):
    scenario = await _make_order_scenario(tag)
    token = await admin_token(client, tag)

    res = await client.get("/api/admin/orders", params={"status": "paid"}, headers=headers(token))
    assert res.status_code == 200
    body = res.json()
    row = next(item for item in body["items"] if item["id"] == scenario.order_id)
    assert row["buyerNickname"] == scenario.buyer_nickname
    assert row["buyerEmail"] == scenario.buyer_email
    assert row["totalPrice"] == 13_000
    assert "address" not in row  # 목록에는 받는 사람·주소가 없다
    assert "recipientName" not in row


async def test_status_filter(client, tag):
    scenario = await _make_order_scenario(tag, order_status="delivered")
    token = await admin_token(client, tag)

    matching = await client.get("/api/admin/orders", params={"status": "delivered"}, headers=headers(token))
    assert scenario.order_id in {item["id"] for item in matching.json()["items"]}

    other = await client.get("/api/admin/orders", params={"status": "paid"}, headers=headers(token))
    assert scenario.order_id not in {item["id"] for item in other.json()["items"]}


async def test_search_by_order_number_and_nickname(client, tag):
    scenario = await _make_order_scenario(tag, nickname=f"검색전용{tag}")
    token = await admin_token(client, tag)

    by_number = await client.get(
        "/api/admin/orders", params={"q": str(scenario.order_id)}, headers=headers(token)
    )
    assert [item["id"] for item in by_number.json()["items"]] == [scenario.order_id]

    by_nickname = await client.get(
        "/api/admin/orders", params={"q": f"검색전용{tag}"}, headers=headers(token)
    )
    assert scenario.order_id in {item["id"] for item in by_nickname.json()["items"]}


async def test_pagination(client, tag):
    order_ids = []
    for i in range(3):
        scenario = await _make_order_scenario(f"{tag}{i}")
        order_ids.append(scenario.order_id)
    token = await admin_token(client, tag)

    res = await client.get(
        "/api/admin/orders", params={"q": tag, "page": 1, "size": 2}, headers=headers(token)
    )
    body = res.json()
    assert len(body["items"]) <= 2
    assert body["totalPages"] >= 1


async def test_detail_includes_recipient_address_items_and_timeline(client, tag):
    scenario = await _make_order_scenario(tag)
    token = await admin_token(client, tag)

    res = await client.get(f"/api/admin/orders/{scenario.order_id}", headers=headers(token))
    assert res.status_code == 200
    body = res.json()
    assert body["recipientName"] == "홍길동"
    assert body["address"] == "서울시 픽셀로 8"
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 2
    assert [entry["status"] for entry in body["timeline"]] == ["paid"]


async def test_detail_unknown_order_is_404(client, tag):
    token = await admin_token(client, tag)
    res = await client.get("/api/admin/orders/999999999", headers=headers(token))
    assert res.status_code == 404


async def test_advance_changes_status_adds_history_and_notifies(client, tag):
    scenario = await _make_order_scenario(tag)
    token = await admin_token(client, tag)

    res = await client.post(f"/api/admin/orders/{scenario.order_id}/advance", headers=headers(token))
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "preparing"
    assert [entry["status"] for entry in body["timeline"]] == ["paid", "preparing"]


async def test_advance_from_delivered_is_409_and_keeps_state(client, tag):
    scenario = await _make_order_scenario(tag, order_status="delivered")
    token = await admin_token(client, tag)

    res = await client.post(f"/api/admin/orders/{scenario.order_id}/advance", headers=headers(token))
    assert res.status_code == 409

    detail = await client.get(f"/api/admin/orders/{scenario.order_id}", headers=headers(token))
    assert detail.json()["status"] == "delivered"
    assert len(detail.json()["timeline"]) == 4  # advance 실패로 타임라인이 늘지 않는다


async def test_advance_from_cancel_requested_is_409(client, tag):
    scenario = await _make_order_scenario(tag, order_status="cancel_requested")
    token = await admin_token(client, tag)

    res = await client.post(f"/api/admin/orders/{scenario.order_id}/advance", headers=headers(token))
    assert res.status_code == 409


async def test_no_login_is_401(client, tag):
    scenario = await _make_order_scenario(tag)
    res = await client.get(f"/api/admin/orders/{scenario.order_id}")
    assert res.status_code == 401


async def test_logged_out_token_is_401(client, tag):
    scenario = await _make_order_scenario(tag)
    token = await admin_token(client, tag)
    await logout(client, token)
    res = await client.get(f"/api/admin/orders/{scenario.order_id}", headers=headers(token))
    assert res.status_code == 401


async def test_non_admin_user_gets_404(client, tag):
    scenario = await _make_order_scenario(tag)
    token = await login(client, f"adminorders-{tag}-user@pixelmart.test", f"일반{tag}")
    client.cookies.clear()
    res = await client.get(f"/api/admin/orders/{scenario.order_id}", headers=headers(token))
    assert res.status_code == 404
