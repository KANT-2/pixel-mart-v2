import uuid
from dataclasses import dataclass

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select, update

from app.core.db import SessionLocal
from app.models import CartItem, Notification, Order, PointTransaction, Product, User
from tests.conftest import headers, login, logout

BODY = {"recipientName": "홍길동", "address": "서울시 마포구 픽셀로 8"}


@dataclass(frozen=True)
class OrderApiContext:
    tag: str
    product_ids: tuple[int, int]

    def email(self, suffix: str) -> str:
        return f"orders-api-{self.tag}-{suffix}@pixelmart.test"


@pytest.fixture
async def order_api(test_products):
    context = OrderApiContext(uuid.uuid4().hex[:8], tuple(test_products))
    yield context

    async with SessionLocal() as session:
        user_ids = list(
            await session.scalars(select(User.id).where(User.email.like(f"orders-api-{context.tag}-%@pixelmart.test")))
        )
        if user_ids:
            await session.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
            await session.execute(delete(CartItem).where(CartItem.user_id.in_(user_ids)))
            await session.execute(delete(Order).where(Order.user_id.in_(user_ids)))
            await session.execute(delete(User).where(User.id.in_(user_ids)))
            await session.commit()


async def sign_in(client: AsyncClient, context: OrderApiContext, suffix: str) -> str:
    return await login(client, context.email(suffix), f"기사{suffix}")


async def add_and_order(client: AsyncClient, product_id: int) -> dict:
    cart = await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1})
    assert cart.status_code == 200, cart.text
    response = await client.post("/api/orders", json=BODY)
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_order_returns_prices_and_status_label(client, order_api):
    await sign_in(client, order_api, "create")
    order = await add_and_order(client, order_api.product_ids[0])

    assert order["status"] == "paid"
    assert order["statusLabel"] == "주문 완료"
    assert (order["itemsPrice"], order["shippingFee"], order["totalPrice"]) == (12_000, 3_000, 15_000)
    assert order["recipientName"] == "홍길동"
    assert (await client.get("/api/cart")).json()["items"] == []


async def test_first_purchase_bonus_and_point_spend(client, order_api):
    await sign_in(client, order_api, "points")
    assert (await client.get("/api/users/me/points")).json()["balance"] == 0

    first = await add_and_order(client, order_api.product_ids[0])
    assert first["pointsUsed"] == 0
    assert (await client.get("/api/users/me/points")).json()["balance"] == 1_000

    await client.post("/api/cart/items", json={"productId": order_api.product_ids[0], "quantity": 1})
    second_response = await client.post("/api/orders", json={**BODY, "pointsUsed": 750})
    assert second_response.status_code == 201, second_response.text
    second = second_response.json()
    assert (second["pointsUsed"], second["totalPrice"]) == (750, 14_250)
    assert (await client.get(f"/api/orders/{second['id']}")).json()["pointsUsed"] == 750
    assert (await client.get("/api/users/me/points")).json()["balance"] == 250

    history = (await client.get("/api/users/me/points/history")).json()
    assert history["total"] == 2
    assert [(row["kind"], row["amount"]) for row in history["items"]] == [
        ("order_spend", -750), ("first_purchase", 1_000)
    ]


async def test_cannot_spend_more_than_balance_and_keeps_cart(client, order_api):
    await sign_in(client, order_api, "point-limit")
    await add_and_order(client, order_api.product_ids[0])
    await client.post("/api/cart/items", json={"productId": order_api.product_ids[0], "quantity": 1})

    response = await client.post("/api/orders", json={**BODY, "pointsUsed": 1_001})
    assert response.status_code == 400
    assert response.json()["detail"] == "보유 포인트가 부족해요."
    assert (await client.get("/api/cart")).json()["totalQuantity"] == 1
    assert (await client.get("/api/users/me/points")).json()["balance"] == 1_000
    assert (await client.post("/api/orders", json={**BODY, "pointsUsed": -1})).status_code == 422


async def test_approved_cancel_refunds_spent_points_once(client, order_api):
    await sign_in(client, order_api, "point-refund")
    await add_and_order(client, order_api.product_ids[0])
    await client.post("/api/cart/items", json={"productId": order_api.product_ids[0], "quantity": 1})
    order = (await client.post("/api/orders", json={**BODY, "pointsUsed": 600})).json()
    assert (await client.get("/api/users/me/points")).json()["balance"] == 400

    request = await client.post(f"/api/orders/{order['id']}/cancel-requests", json={"reason": "단순 변심"})
    assert request.status_code == 201, request.text
    approval = await client.post(f"/api/dev/cancel-requests/{request.json()['id']}/approve")
    assert approval.status_code == 200, approval.text
    assert (await client.get("/api/users/me/points")).json()["balance"] == 1_000
    assert (await client.get("/api/users/me/points/history")).json()["total"] == 3
    await client.post("/api/cart/items", json={"productId": order_api.product_ids[0], "quantity": 1})
    third = await client.post("/api/orders", json=BODY)
    assert third.status_code == 201, third.text
    assert (await client.get("/api/users/me/points")).json()["balance"] == 1_000


async def test_point_history_is_private(client, order_api):
    assert (await client.get("/api/users/me/points")).status_code == 401
    assert (await client.get("/api/users/me/points/history")).status_code == 401
    await sign_in(client, order_api, "point-owner")
    await add_and_order(client, order_api.product_ids[0])
    await sign_in(client, order_api, "point-other")
    assert (await client.get("/api/users/me/points")).json()["balance"] == 0
    assert (await client.get("/api/users/me/points/history")).json()["total"] == 0


async def test_existing_customer_does_not_receive_first_purchase_bonus(client, order_api):
    await sign_in(client, order_api, "legacy-points")
    first = await add_and_order(client, order_api.product_ids[0])
    # 포인트 기능 도입 전 주문을 재현한다.
    async with SessionLocal() as session:
        await session.execute(delete(PointTransaction).where(PointTransaction.order_id == first["id"]))
        await session.commit()

    await add_and_order(client, order_api.product_ids[0])
    assert (await client.get("/api/users/me/points")).json()["balance"] == 0
    assert (await client.get("/api/users/me/points/history")).json()["total"] == 0


async def test_create_order_validates_recipient_without_touching_cart(client, order_api):
    await sign_in(client, order_api, "invalid")
    await client.post("/api/cart/items", json={"productId": order_api.product_ids[0], "quantity": 1})

    response = await client.post("/api/orders", json={"recipientName": "   ", "address": BODY["address"]})

    assert response.status_code == 422
    assert (await client.get("/api/cart")).json()["totalQuantity"] == 1


async def test_create_order_requires_login(client):
    assert (await client.post("/api/orders", json=BODY)).status_code == 401


async def test_empty_cart_is_409(client, order_api):
    await sign_in(client, order_api, "empty")

    response = await client.post("/api/orders", json=BODY)

    assert response.status_code == 409
    assert response.json()["detail"] == "장바구니가 비어 있어요."


async def test_out_of_stock_is_409_and_keeps_cart(client, order_api):
    await sign_in(client, order_api, "stock")
    product_id = order_api.product_ids[1]
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1})
    async with SessionLocal() as session:
        await session.execute(update(Product).where(Product.id == product_id).values(stock=0))
        await session.commit()

    response = await client.post("/api/orders", json=BODY)

    assert response.status_code == 409
    assert response.json()["detail"] == "품절된 상품이에요."
    assert (await client.get("/api/cart")).json()["totalQuantity"] == 1


async def test_other_users_order_is_hidden_as_404(client, order_api):
    await sign_in(client, order_api, "owner")
    order = await add_and_order(client, order_api.product_ids[0])
    await sign_in(client, order_api, "other")

    response = await client.get(f"/api/orders/{order['id']}")

    assert response.status_code == 404
    assert response.json()["detail"] == "주문을 찾을 수 없어요."


async def test_logged_out_token_is_401(client, order_api):
    token = await sign_in(client, order_api, "logout")
    await logout(client, token)
    client.cookies.clear()

    assert (await client.get("/api/orders", headers=headers(token))).status_code == 401


async def test_list_filters_searches_and_paginates(client, order_api):
    await sign_in(client, order_api, "list")
    first = await add_and_order(client, order_api.product_ids[0])
    second = await add_and_order(client, order_api.product_ids[1])
    third = await add_and_order(client, order_api.product_ids[0])
    async with SessionLocal() as session:
        await session.execute(update(Order).where(Order.id == first["id"]).values(status="delivered"))
        await session.commit()

    filtered = (await client.get("/api/orders", params={"status": "delivered"})).json()
    by_product = (await client.get("/api/orders", params={"q": "테스트 전용 상품 2"})).json()
    by_number = (await client.get("/api/orders", params={"q": f"#{second['id']}"})).json()
    second_page = (await client.get("/api/orders", params={"page": 2, "size": 2})).json()

    assert [item["id"] for item in filtered["items"]] == [first["id"]]
    assert [item["id"] for item in by_product["items"]] == [second["id"]]
    assert [item["id"] for item in by_number["items"]] == [second["id"]]
    assert second_page["total"] == 3
    assert second_page["totalPages"] == 2
    assert [item["id"] for item in second_page["items"]] == [first["id"]]
    assert {"itemsPrice", "shippingFee", "totalPrice", "statusLabel"} <= second_page["items"][0].keys()
    assert third["id"] > second["id"] > first["id"]
