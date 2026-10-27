"""관리자 상품 API (#93) — 등록·수정·숨김·재고 조정과 공개 상품 노출을 함께 확인한다."""

import pytest
from sqlalchemy import text

from app.core.db import engine
from tests.conftest import headers, login

ADMIN = "admin-products@pixelmart.test"
MEMBER = "member-products@pixelmart.test"
URL = "/api/admin/products"


@pytest.fixture
async def created_product_ids():
    ids: list[int] = []
    yield ids
    async with engine.begin() as connection:
        await connection.execute(text("DELETE FROM products WHERE id = ANY(:ids)"), {"ids": ids or [-1]})


async def category_slug(client) -> str:
    response = await client.get("/api/categories")
    assert response.status_code == 200, response.text
    return response.json()[0]["slug"]


def product_body(category: str, **changes) -> dict:
    return {
        "name": "관리자 API 테스트 상품",
        "price": 12_000,
        "categorySlug": category,
        "description": "관리자가 등록한 테스트 전용 상품입니다.",
        "imageUrl": "/images/products/test-only.png",
        "isNew": True,
        "stock": 0,
        "rarity": "rare",
    } | changes


async def create(client, token: str, category: str, ids: list[int], **changes) -> dict:
    response = await client.post(URL, json=product_body(category, **changes), headers=headers(token))
    assert response.status_code == 201, response.text
    product = response.json()
    ids.append(product["id"])
    return product


async def test_admin_creates_product_that_is_visible_publicly(client, created_product_ids):
    admin = await login(client, ADMIN, admin=True)
    product = await create(client, admin, await category_slug(client), created_product_ids)

    assert product["isHidden"] is False
    assert (product["name"], product["stock"], product["rarity"]) == ("관리자 API 테스트 상품", 0, "rare")
    public = await client.get(f"/api/products/{product['id']}")
    assert public.status_code == 200
    assert public.json()["stock"] == 0  # 품절이어도 숨긴 상품과 달리 공개된다.


async def test_admin_changes_product_rarity_and_public_response_reflects_it(client, created_product_ids):
    admin = await login(client, ADMIN, admin=True)
    product = await create(client, admin, await category_slug(client), created_product_ids, rarity="common")

    updated = await client.patch(f"{URL}/{product['id']}", json={"rarity": "unique"}, headers=headers(admin))

    assert (updated.status_code, updated.json()["rarity"]) == (200, "unique")
    public = await client.get(f"/api/products/{product['id']}")
    assert (public.status_code, public.json()["rarity"]) == (200, "unique")


async def test_admin_restocks_by_adding_to_existing_stock(client, created_product_ids):
    admin = await login(client, ADMIN, admin=True)
    product = await create(client, admin, await category_slug(client), created_product_ids, stock=4)

    restocked = await client.patch(f"{URL}/{product['id']}", json={"stock": 3}, headers=headers(admin))

    assert (restocked.status_code, restocked.json()["stock"]) == (200, 7)
    public = await client.get(f"/api/products/{product['id']}")
    assert (public.status_code, public.json()["stock"]) == (200, 7)


async def test_admin_hides_lists_and_restocks_product(client, created_product_ids):
    admin = await login(client, ADMIN, admin=True)
    product = await create(
        client, admin, await category_slug(client), created_product_ids, name="숨김·재입고 테스트 상품"
    )

    sold_out = await client.get(URL, params={"soldOut": "true", "q": product["name"]}, headers=headers(admin))
    assert [item["id"] for item in sold_out.json()["items"]] == [product["id"]]

    hidden = await client.patch(f"{URL}/{product['id']}", json={"isHidden": True}, headers=headers(admin))
    assert hidden.status_code == 200 and hidden.json()["isHidden"] is True
    assert (await client.get(f"/api/products/{product['id']}")).status_code == 404

    hidden_list = await client.get(URL, params={"hidden": "true", "q": product["name"]}, headers=headers(admin))
    assert [item["id"] for item in hidden_list.json()["items"]] == [product["id"]]

    restocked = await client.patch(
        f"{URL}/{product['id']}", json={"stock": 7, "isHidden": False}, headers=headers(admin)
    )
    assert restocked.status_code == 200
    assert (restocked.json()["stock"], restocked.json()["isHidden"]) == (7, False)
    public = await client.get(f"/api/products/{product['id']}")
    assert (public.status_code, public.json()["stock"]) == (200, 7)


async def test_admin_filters_and_validates_product_input(client, created_product_ids):
    admin = await login(client, ADMIN, admin=True)
    category = await category_slug(client)
    product = await create(client, admin, category, created_product_ids, name="필터 대상 상품", rarity="epic", stock=4)

    listed = await client.get(
        URL,
        params={"category": category, "rarity": "epic", "soldOut": "false", "q": "필터 대상"},
        headers=headers(admin),
    )
    assert [item["id"] for item in listed.json()["items"]] == [product["id"]]

    invalid_image = await client.post(
        URL, json=product_body(category, imageUrl="https://example.com/item.png"), headers=headers(admin)
    )
    assert invalid_image.status_code == 422
    invalid_category = await client.post(URL, json=product_body("not-a-category"), headers=headers(admin))
    assert invalid_category.status_code == 422
    assert (await client.patch(f"{URL}/999999999", json={"stock": 1}, headers=headers(admin))).status_code == 404


async def test_admin_products_require_admin_role(client, created_product_ids):
    member = await login(client, MEMBER)
    assert (await client.get(URL, headers=headers(member))).status_code == 404
    assert (await client.post(URL, json={}, headers=headers(member))).status_code == 404
    client.cookies.clear()
    assert (await client.get(URL)).status_code == 401
