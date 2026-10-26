"""상품 등급 목록·필터 API (API는 로컬 DB 필요)."""

import pytest
from sqlalchemy import text

from app.core.db import engine


@pytest.fixture
async def db_ready():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM products LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 시드 전입니다 (alembic upgrade head → python -m scripts.seed)")


async def test_rarities_cover_all_products(client, db_ready):
    rarities = (await client.get("/api/rarities")).json()
    assert [r["key"] for r in rarities] == ["common", "rare", "epic", "unique"]
    assert all(set(rarity) == {"key", "label", "count"} for rarity in rarities)
    total = (await client.get("/api/products", params={"size": 1})).json()["total"]
    assert sum(r["count"] for r in rarities) == total


async def test_rarities_within_category(client, db_ready):
    rarities = (await client.get("/api/rarities", params={"category": "keycap"})).json()
    keycaps = (await client.get("/api/products", params={"category": "keycap", "size": 1})).json()["total"]
    assert sum(r["count"] for r in rarities) == keycaps


async def test_product_items_carry_rarity(client, db_ready):
    items = (await client.get("/api/products", params={"size": 60})).json()["items"]
    assert items and all(item["rarity"] in {"common", "rare", "epic", "unique"} for item in items)
    detail = (await client.get(f"/api/products/{items[0]['id']}")).json()
    assert detail["rarity"] in {"common", "rare", "epic", "unique"}


async def test_filter_by_rarity_matches_counts(client, db_ready):
    counts = {r["key"]: r["count"] for r in (await client.get("/api/rarities")).json()}

    epic = (await client.get("/api/products", params={"rarity": "unique", "size": 60})).json()
    assert epic["total"] == counts["unique"]
    assert all(item["rarity"] == "unique" for item in epic["items"])

    both = (await client.get("/api/products", params={"rarity": "common,UNIQUE", "size": 1})).json()
    assert both["total"] == counts["common"] + counts["unique"]


async def test_rarity_with_category(client, db_ready):
    counts = {r["key"]: r["count"] for r in (await client.get("/api/rarities", params={"category": "keycap"})).json()}
    res = (await client.get("/api/products", params={"rarity": "common", "category": "keycap", "size": 60})).json()
    assert res["total"] == counts["common"]
    assert {item["categorySlug"] for item in res["items"]} <= {"keycap"}


async def test_unknown_rarity_is_422(client, db_ready):
    res = await client.get("/api/products", params={"rarity": "legendary"})
    assert res.status_code == 422
    assert "legendary" in res.json()["detail"]
