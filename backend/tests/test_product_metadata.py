
"""상품 등급·숨김 규칙 테스트 — 테스트 전용 상품만 수정한다."""

from sqlalchemy import text

from app.core.db import engine


async def rarity_counts(client, category: str) -> dict[str, int]:
    """카테고리별 등급 개수를 가져온다."""
    response = await client.get(
        "/api/rarities",
        params={"category": category},
    )
    assert response.status_code == 200
    return {
        item["key"]: item["count"]
        for item in response.json()
    }


async def test_hidden_product_is_excluded_from_public_api(
    client,
    test_products,
):
    hidden_id, visible_id = test_products

    detail = await client.get(f"/api/products/{hidden_id}")
    assert detail.status_code == 200
    category = detail.json()["categorySlug"]

    before = await rarity_counts(client, category)

    # fixture가 생성한 테스트 전용 상품 하나만 숨긴다.
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "UPDATE products "
                "SET is_hidden = TRUE "
                "WHERE id = :product_id"
            ),
            {"product_id": hidden_id},
        )

    listing = await client.get(
        "/api/products",
        params={"q": "테스트 전용 상품", "size": 60},
    )
    assert listing.status_code == 200
    assert {
        item["id"] for item in listing.json()["items"]
    } == {visible_id}

    hidden_detail = await client.get(
        f"/api/products/{hidden_id}"
    )
    assert hidden_detail.status_code == 404

    after = await rarity_counts(client, category)
    assert after["common"] == before["common"] - 1


async def test_rarity_uses_database_value_not_price(
    client,
    test_products,
):
    changed_id, unchanged_id = test_products

    original = await client.get(f"/api/products/{changed_id}")
    assert original.status_code == 200
    assert original.json()["price"] == 12000
    assert original.json()["rarity"] == "common"

    category = original.json()["categorySlug"]
    before = await rarity_counts(client, category)

    # 가격은 그대로 두고 등급만 변경한다.
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "UPDATE products "
                "SET rarity = 'unique' "
                "WHERE id = :product_id"
            ),
            {"product_id": changed_id},
        )

    detail = await client.get(f"/api/products/{changed_id}")
    assert detail.status_code == 200
    assert detail.json()["price"] == 12000
    assert detail.json()["rarity"] == "unique"
    assert detail.json()["stock"] == 999

    unique_list = await client.get(
        "/api/products",
        params={
            "q": "테스트 전용 상품",
            "rarity": "unique",
        },
    )
    assert unique_list.status_code == 200
    assert {
        item["id"] for item in unique_list.json()["items"]
    } == {changed_id}

    common_list = await client.get(
        "/api/products",
        params={
            "q": "테스트 전용 상품",
            "rarity": "common",
        },
    )
    assert common_list.status_code == 200
    assert {
        item["id"] for item in common_list.json()["items"]
    } == {unchanged_id}

    after = await rarity_counts(client, category)
    assert after["common"] == before["common"] - 1
    assert after["unique"] == before["unique"] + 1

    response = await client.get("/api/rarities")
    assert response.status_code == 200

    for item in response.json():
        assert set(item) == {"key", "label", "count"}
