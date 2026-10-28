"""관리자 리뷰 관리 — 숨김 · 다시 보이기 (로컬 DB 필요, 없으면 건너뜀)"""

import uuid

import pytest
from sqlalchemy import delete, text

from app.core.db import SessionLocal, engine
from app.models import User
from src.admin_reviews.domain.moderation import ReviewState, newly_hidden
from tests.conftest import headers, login, logout

BODY = {"recipientName": "홍길동", "address": "서울시 마포구 픽셀로 8"}
PHOTO = "data:image/png;base64,iVBORw0KGgo="

# --- 도메인 규칙 (DB 없음) ---


def test_notify_only_when_newly_hidden():
    shown = ReviewState(1, 7, 3, is_hidden=False)
    hidden = ReviewState(2, 7, 3, is_hidden=True)
    assert newly_hidden(shown, True)
    assert not newly_hidden(hidden, True)  # 이미 숨긴 리뷰는 알림 다시 안 보냄
    assert not newly_hidden(hidden, False)


# --- API (진짜 DB) ---


@pytest.fixture
async def tag(test_products):
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT image_urls FROM reviews LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value, test_products[0]
    async with SessionLocal() as session:  # 이 테스트가 만든 계정만 (리뷰 · 주문 · 알림은 함께 지워짐)
        await session.execute(delete(User).where(User.email.like(f"adminreviews-{value}%@pixelmart.test")))
        await session.commit()


async def write_review(client, value: str, product_id: int) -> tuple[str, int]:
    """배송 완료까지 진행한 뒤 사진 리뷰를 남기고 (작성자 토큰, 리뷰 id)"""
    token = await login(client, f"adminreviews-{value}-writer@pixelmart.test", f"리뷰어{value}")
    auth = headers(token)
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1}, headers=auth)
    order_id = (await client.post("/api/orders", json=BODY, headers=auth)).json()["id"]
    for _ in range(3):
        await client.post(f"/api/dev/orders/{order_id}/advance", headers=auth)
    res = await client.post(
        f"/api/products/{product_id}/reviews",
        json={"rating": 2, "content": f"관리 테스트 {value}", "imageUrls": [PHOTO]},
        headers=auth,
    )
    assert res.status_code == 201, res.text
    client.cookies.clear()
    return token, res.json()["id"]


async def hidden_notices(client, token: str) -> list[dict]:
    res = await client.get("/api/notifications", headers=headers(token))
    return [n for n in res.json()["items"] if n["kind"] == "review_hidden"]


async def test_admin_hides_and_shows_review(client, tag):
    value, product_id = tag
    writer, review_id = await write_review(client, value, product_id)
    admin = await login(client, f"adminreviews-{value}-boss@pixelmart.test", f"관리{value}", admin=True)
    client.cookies.clear()
    auth = headers(admin)

    listed = await client.get(
        "/api/admin/reviews", params={"q": f"리뷰어{value}", "rating": 2, "photo": True}, headers=auth
    )
    assert listed.status_code == 200
    rows = listed.json()["items"]
    assert [r["id"] for r in rows] == [review_id]
    assert rows[0]["authorEmail"] == f"adminreviews-{value}-writer@pixelmart.test"
    assert rows[0]["productName"] and rows[0]["isHidden"] is False and rows[0]["imageUrls"] == [PHOTO]
    assert (
        await client.get("/api/admin/reviews", params={"q": f"리뷰어{value}", "photo": False}, headers=auth)
    ).json()["total"] == 0

    for _ in range(2):  # 두 번 숨겨도 알림은 한 번
        hidden = await client.patch(f"/api/admin/reviews/{review_id}", json={"hidden": True}, headers=auth)
        assert hidden.status_code == 200 and hidden.json()["isHidden"] is True
    assert len(await hidden_notices(client, writer)) == 1
    public = (await client.get(f"/api/products/{product_id}/reviews")).json()["items"]
    assert review_id not in [r["id"] for r in public]
    only_hidden = await client.get("/api/admin/reviews", params={"q": f"리뷰어{value}", "hidden": True}, headers=auth)
    assert [r["id"] for r in only_hidden.json()["items"]] == [review_id]

    shown = await client.patch(f"/api/admin/reviews/{review_id}", json={"hidden": False}, headers=auth)
    assert shown.status_code == 200 and shown.json()["isHidden"] is False
    public = (await client.get(f"/api/products/{product_id}/reviews")).json()["items"]
    assert review_id in [r["id"] for r in public]


async def test_admin_reviews_need_admin_and_live_token(client, tag):
    value, product_id = tag
    writer, review_id = await write_review(client, value, product_id)
    # 일반 사용자는 관리자 API가 있는지도 모르게 404
    assert (await client.get("/api/admin/reviews", headers=headers(writer))).status_code == 404
    assert (
        await client.patch(f"/api/admin/reviews/{review_id}", json={"hidden": True}, headers=headers(writer))
    ).status_code == 404

    admin = await login(client, f"adminreviews-{value}-boss@pixelmart.test", f"관리{value}", admin=True)
    client.cookies.clear()
    missing = await client.patch("/api/admin/reviews/999999999", json={"hidden": True}, headers=headers(admin))
    assert missing.status_code == 404
    assert missing.json()["detail"] == "리뷰를 찾을 수 없어요."
    bad = await client.patch(f"/api/admin/reviews/{review_id}", json={"hidden": "yes"}, headers=headers(admin))
    assert bad.status_code == 422

    await logout(client, admin)  # 로그아웃한 같은 토큰은 401
    assert (await client.get("/api/admin/reviews", headers=headers(admin))).status_code == 401
