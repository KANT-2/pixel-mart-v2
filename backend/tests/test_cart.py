"""장바구니 API — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM cart_items LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")


@pytest.fixture
async def cart_products():
    """시드 재고와 격리된 장바구니 전용 상품을 만들고 삭제한다."""
    tag = uuid4().hex[:10]
    specs = {
        "price_29000": (29_000, 3),
        "price_15000": (15_000, 2),
        "limited": (12_000, 3),
        "many": (1_000, 999),
        "other": (5_000, 10),
    }
    try:
        async with engine.begin() as conn:
            slug = await conn.scalar(text("SELECT slug FROM categories ORDER BY sort_order LIMIT 1"))
            if slug is None:
                raise LookupError("카테고리 없음")
            product_ids = {}
            for name, (price, stock) in specs.items():
                row = await conn.execute(
                    text(
                        "INSERT INTO products (name, price, stock, category_slug, image_url, description, is_new) "
                        "VALUES (:name, :price, :stock, :slug, '/images/products/test-only.png', '테스트 전용', false) "
                        "RETURNING id"
                    ),
                    {
                        "name": f"장바구니 테스트 {name} {tag}",
                        "price": price,
                        "stock": stock,
                        "slug": slug,
                    },
                )
                product_ids[name] = row.scalar_one()
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다 (alembic upgrade head → python -m scripts.seed)")

    yield product_ids

    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM products WHERE id = ANY(:ids)"), {"ids": list(product_ids.values())})


async def login(client: AsyncClient, email: str) -> None:
    res = await client.post("/api/auth/dev-login", json={"email": email})
    assert res.status_code == 200
    # 재실행해도 같은 결과가 나오도록 장바구니를 비우고 시작
    for item in (await client.get("/api/cart")).json()["items"]:
        await client.delete(f"/api/cart/items/{item['product']['id']}")


def assert_prices(cart: dict, *, items: int, shipping: int, left: int, total: int) -> None:
    assert cart["itemsPrice"] == items
    assert cart["shippingFee"] == shipping
    assert cart["freeShippingLeft"] == left
    assert cart["totalPrice"] == total


async def test_cart_requires_login(client):
    res = await client.get("/api/cart")
    assert res.status_code == 401


async def test_get_add_and_update_return_same_price_fields(client, cart_products):
    await login(client, "cart-prices@pixelmart.test")
    price_29000 = cart_products["price_29000"]
    price_15000 = cart_products["price_15000"]

    added = (await client.post("/api/cart/items", json={"productId": price_29000, "quantity": 1})).json()
    assert_prices(added, items=29_000, shipping=3_000, left=1_000, total=32_000)

    fetched = (await client.get("/api/cart")).json()
    assert_prices(fetched, items=29_000, shipping=3_000, left=1_000, total=32_000)

    await client.delete(f"/api/cart/items/{price_29000}")
    await client.post("/api/cart/items", json={"productId": price_15000, "quantity": 1})
    updated = (await client.patch(f"/api/cart/items/{price_15000}", json={"quantity": 2})).json()
    assert_prices(updated, items=30_000, shipping=0, left=0, total=30_000)

    price_fields = {"itemsPrice", "shippingFee", "freeShippingLeft", "totalPrice"}
    assert all(price_fields <= response.keys() for response in (added, fetched, updated))


async def test_add_same_product_merges_quantity(client, cart_products):
    await login(client, "cart2@pixelmart.test")
    product_id = cart_products["many"]
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 2})
    cart = (await client.post("/api/cart/items", json={"productId": product_id, "quantity": 5})).json()
    assert len(cart["items"]) == 1
    assert cart["items"][0]["quantity"] == 7


async def test_add_over_max_quantity_is_400(client, cart_products):
    await login(client, "cart3@pixelmart.test")
    product_id = cart_products["many"]
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 90})
    res = await client.post("/api/cart/items", json={"productId": product_id, "quantity": 10})
    assert res.status_code == 400
    assert (await client.get("/api/cart")).json()["items"][0]["quantity"] == 90


async def test_add_missing_product_is_404(client):
    await login(client, "cart4@pixelmart.test")
    res = await client.post("/api/cart/items", json={"productId": 999_999_999, "quantity": 1})
    assert res.status_code == 404


@pytest.mark.parametrize("quantity", [0, 100])
async def test_quantity_out_of_range_is_422(client, cart_products, quantity):
    await login(client, "cart5@pixelmart.test")
    product_id = cart_products["many"]
    res = await client.post("/api/cart/items", json={"productId": product_id, "quantity": quantity})
    assert res.status_code == 422

    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1})
    res = await client.patch(f"/api/cart/items/{product_id}", json={"quantity": quantity})
    assert res.status_code == 422


async def test_add_over_stock_is_409_and_preserves_existing_quantity(client, cart_products):
    await login(client, "cart-stock-add@pixelmart.test")
    product_id = cart_products["limited"]
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1})

    res = await client.post("/api/cart/items", json={"productId": product_id, "quantity": 3})

    assert res.status_code == 409
    assert res.json() == {"detail": "재고가 부족해요. (남은 수량 3개)"}
    assert (await client.get("/api/cart")).json()["items"][0]["quantity"] == 1


async def test_update_over_stock_is_409_and_preserves_quantity(client, cart_products):
    await login(client, "cart-stock-update@pixelmart.test")
    product_id = cart_products["limited"]
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 2})

    res = await client.patch(f"/api/cart/items/{product_id}", json={"quantity": 4})

    assert res.status_code == 409
    assert res.json() == {"detail": "재고가 부족해요. (남은 수량 3개)"}
    assert (await client.get("/api/cart")).json()["items"][0]["quantity"] == 2


async def test_update_and_delete(client, cart_products):
    await login(client, "cart6@pixelmart.test")
    product_id = cart_products["other"]
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1})

    updated = await client.patch(f"/api/cart/items/{product_id}", json={"quantity": 5})
    assert updated.json()["items"][0]["quantity"] == 5

    deleted = await client.delete(f"/api/cart/items/{product_id}")
    assert deleted.json() == {
        "items": [],
        "totalQuantity": 0,
        "itemsPrice": 0,
        "shippingFee": 0,
        "freeShippingLeft": 30_000,
        "totalPrice": 0,
    }

    assert (await client.delete(f"/api/cart/items/{product_id}")).status_code == 404
    assert (await client.patch(f"/api/cart/items/{product_id}", json={"quantity": 1})).status_code == 404


async def test_carts_are_separated_by_user(client, cart_products):
    await login(client, "cart7@pixelmart.test")
    product_id = cart_products["other"]
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        await login(other, "cart8@pixelmart.test")
        assert (await other.get("/api/cart")).json()["items"] == []
        # 남의 장바구니 항목은 404로 숨김
        assert (await other.delete(f"/api/cart/items/{product_id}")).status_code == 404

    assert len((await client.get("/api/cart")).json()["items"]) == 1
