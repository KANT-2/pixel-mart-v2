"""쇼핑몰 기본기 — 배송지·결제수단·쿠폰·운송장·구매 확정·반품/교환·비밀번호·포토 리뷰"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.db import engine
from src.addresses.domain.rules import check_postal_code, normalize_phone
from src.coupons.domain.rules import CouponTerms, InvalidCoupon, discount_for
from src.returns.domain.rules import AfterDeliveryError, check_returnable, purchase_reward, resolved_status
from tests.conftest import login

PRODUCT = 0
SHIPPING = {
    "recipientName": "홍길동",
    "phone": "01012345678",
    "postalCode": "04001",
    "address": "서울 마포구 픽셀로 8",
    "addressDetail": "3층",
    "deliveryMemo": "문 앞에 놓아 주세요",
    "paymentMethod": "easy_pay",
}


@pytest.fixture(autouse=True)
async def clean(test_products):
    global PRODUCT
    PRODUCT = test_products[0]
    async with engine.begin() as conn:
        for table in ("orders", "shipping_addresses", "user_coupons", "point_transactions", "notifications"):
            await conn.execute(
                text(
                    f"DELETE FROM {table} WHERE user_id IN "
                    "(SELECT id FROM users WHERE email LIKE 'shop-%@pixelmart.test')"
                )
            )


async def order(client: AsyncClient, quantity: int = 2, **extra) -> dict:
    for item in (await client.get("/api/cart")).json()["items"]:
        await client.delete(f"/api/cart/items/{item['product']['id']}")
    await client.post("/api/cart/items", json={"productId": PRODUCT, "quantity": quantity})
    res = await client.post("/api/orders", json={**SHIPPING, **extra})
    assert res.status_code == 201, res.text
    return res.json()


async def deliver(client: AsyncClient, order_id: int) -> None:
    for _ in range(3):
        await client.post(f"/api/dev/orders/{order_id}/advance")


# ---- 순수 규칙 ----
def test_phone_and_postal_code_rules():
    assert normalize_phone("010 1234 5678") == "010-1234-5678"
    assert normalize_phone("02-123-4567") == "02-123-4567"
    with pytest.raises(ValueError):
        normalize_phone("12345")
    assert check_postal_code(" 04001 ") == "04001"
    with pytest.raises(ValueError):
        check_postal_code("1234")


def test_coupon_discount_rules():
    percent = CouponTerms("percent", 10, 30000, 5000)
    assert discount_for(percent, 40000) == 4000
    assert discount_for(percent, 90000) == 5000  # 최대 할인
    with pytest.raises(InvalidCoupon):
        discount_for(percent, 20000)  # 최소 주문 금액 미달
    assert discount_for(CouponTerms("amount", 3000, 0, None), 2000) == 2000  # 상품 금액을 넘지 않는다


def test_after_delivery_rules():
    check_returnable("delivered", None)
    with pytest.raises(AfterDeliveryError):
        check_returnable("shipping", None)
    assert purchase_reward(27000) == 270
    assert resolved_status("return", True) == "returned"
    assert resolved_status("exchange", True) == "preparing"
    assert resolved_status("exchange", False) == "delivered"


# ---- 배송지 ----
async def test_addresses_first_is_default_and_delete_promotes(client):
    await login(client, "shop-addr@pixelmart.test")
    base = {k: SHIPPING[k] for k in ("recipientName", "phone", "postalCode", "address", "addressDetail")}
    first = await client.post("/api/users/me/addresses", json={**base, "label": "집"})
    assert first.status_code == 201
    assert first.json()[0]["isDefault"] is True and first.json()[0]["phone"] == "010-1234-5678"
    rows = (await client.post("/api/users/me/addresses", json={**base, "label": "회사", "isDefault": True})).json()
    assert [row["label"] for row in rows] == ["회사", "집"]
    await client.delete(f"/api/users/me/addresses/{rows[0]['id']}")
    rows = (await client.get("/api/users/me/addresses")).json()
    assert len(rows) == 1 and rows[0]["isDefault"] is True
    bad = await client.post("/api/users/me/addresses", json={**base, "label": "x", "phone": "abc"})
    assert bad.status_code == 422


async def test_addresses_of_others_are_hidden(client):
    await login(client, "shop-owner@pixelmart.test")
    base = {k: SHIPPING[k] for k in ("recipientName", "phone", "postalCode", "address")}
    address_id = (await client.post("/api/users/me/addresses", json={**base, "label": "집"})).json()[0]["id"]
    await login(client, "shop-other@pixelmart.test")
    assert (await client.delete(f"/api/users/me/addresses/{address_id}")).status_code == 404


# ---- 주문 · 쿠폰 ----
async def test_order_keeps_shipping_payment_and_saves_address(client):
    await login(client, "shop-order@pixelmart.test")
    placed = await order(client, saveAddress=True)
    assert placed["phone"] == "010-1234-5678"
    assert placed["paymentLabel"] == "간편결제"
    assert placed["deliveryMemo"] == "문 앞에 놓아 주세요"
    addresses = (await client.get("/api/users/me/addresses")).json()
    assert addresses[0]["isDefault"] and addresses[0]["addressDetail"] == "3층"


async def test_welcome_coupon_discounts_once_and_returns_on_cancel(client):
    await login(client, "shop-coupon@pixelmart.test")
    coupons = (await client.get("/api/users/me/coupons")).json()
    welcome = next(c for c in coupons if c["name"] == "웰컴 쿠폰")
    assert welcome["status"] == "available"

    placed = await order(client, userCouponId=welcome["id"])  # 12,000 × 2 + 배송비 3,000 - 3,000
    assert placed["couponDiscount"] == 3000
    assert placed["totalPrice"] == 24000
    again = await client.post("/api/orders", json={**SHIPPING, "userCouponId": welcome["id"]})
    assert again.status_code in (400, 409)  # 이미 쓴 쿠폰 (장바구니가 비어 있으면 409)

    # 취소가 승인되면 쿠폰을 돌려받는다
    request_id = (await client.post(f"/api/orders/{placed['id']}/cancel-requests", json={"reason": "변심"})).json()[
        "id"
    ]
    await client.post(f"/api/dev/cancel-requests/{request_id}/approve")
    coupons = (await client.get("/api/users/me/coupons")).json()
    assert next(c for c in coupons if c["id"] == welcome["id"])["status"] == "available"


async def test_coupon_code_register_and_min_order(client):
    await login(client, "shop-code@pixelmart.test")
    assert (await client.post("/api/users/me/coupons", json={"code": "없는코드"})).status_code == 400
    rows = (await client.post("/api/users/me/coupons", json={"code": "pixelmart"})).json()
    coupon = next(c for c in rows if c["name"] == "픽셀마트 10% 할인")
    assert (await client.post("/api/users/me/coupons", json={"code": "PIXELMART"})).status_code == 400  # 중복
    for item in (await client.get("/api/cart")).json()["items"]:
        await client.delete(f"/api/cart/items/{item['product']['id']}")
    await client.post("/api/cart/items", json={"productId": PRODUCT, "quantity": 1})
    res = await client.post("/api/orders", json={**SHIPPING, "userCouponId": coupon["id"]})
    assert res.status_code == 400  # 12,000원 < 최소 30,000원


# ---- 운송장 · 구매 확정 · 반품/교환 ----
async def test_admin_tracking_then_confirm_rewards_points(client):
    await login(client, "shop-confirm@pixelmart.test")
    placed = await order(client)
    await client.post(f"/api/dev/orders/{placed['id']}/advance")  # 상품 준비중
    await login(client, "shop-admin@pixelmart.test", admin=True)
    bad = await client.put(f"/api/admin/orders/{placed['id']}/tracking", json={"courier": "cj", "trackingNumber": "12"})
    assert bad.status_code == 422
    res = await client.put(
        f"/api/admin/orders/{placed['id']}/tracking", json={"courier": "cj", "trackingNumber": "123456789012"}
    )
    assert res.status_code == 200 and res.json()["courierLabel"] == "CJ대한통운"

    await login(client, "shop-confirm@pixelmart.test")
    assert (await client.post(f"/api/orders/{placed['id']}/confirm")).status_code == 400  # 아직 배송 전
    await client.post(f"/api/dev/orders/{placed['id']}/advance")
    await client.post(f"/api/dev/orders/{placed['id']}/advance")
    res = await client.post(f"/api/orders/{placed['id']}/confirm")
    assert res.status_code == 200 and res.json()["reward"] == placed["totalPrice"] // 100
    detail = (await client.get(f"/api/orders/{placed['id']}")).json()
    assert detail["confirmedAt"] and detail["trackingNumber"] == "123456789012"
    returned = await client.post(
        f"/api/orders/{placed['id']}/return-requests", json={"kind": "return", "reason": "변심"}
    )
    assert returned.status_code == 400  # 확정 뒤에는 반품 불가


async def test_return_approved_restores_stock_and_points(client):
    await login(client, "shop-return@pixelmart.test")
    async with engine.connect() as conn:
        stock = await conn.scalar(text("SELECT stock FROM products WHERE id = :id"), {"id": PRODUCT})
    placed = await order(client)
    await deliver(client, placed["id"])
    res = await client.post(f"/api/orders/{placed['id']}/return-requests", json={"kind": "return", "reason": "불량"})
    assert res.status_code == 201
    detail = (await client.get(f"/api/orders/{placed['id']}")).json()
    assert detail["status"] == "return_requested" and detail["returnRequest"]["kind"] == "return"

    await login(client, "shop-admin@pixelmart.test", admin=True)
    rows = (await client.get("/api/admin/return-requests", params={"status": "requested"})).json()["items"]
    request_id = next(row["id"] for row in rows if row["orderId"] == placed["id"])
    assert (await client.post(f"/api/admin/return-requests/{request_id}/approve")).status_code == 200
    assert (await client.post(f"/api/admin/return-requests/{request_id}/approve")).status_code == 400

    await login(client, "shop-return@pixelmart.test")
    assert (await client.get(f"/api/orders/{placed['id']}")).json()["status"] == "returned"
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT stock FROM products WHERE id = :id"), {"id": PRODUCT}) == stock


async def test_exchange_approved_goes_back_to_preparing_and_reject_returns_delivered(client):
    await login(client, "shop-exchange@pixelmart.test")
    first = await order(client)
    await deliver(client, first["id"])
    await client.post(f"/api/orders/{first['id']}/return-requests", json={"kind": "exchange", "reason": "사이즈"})
    second = await order(client)
    await deliver(client, second["id"])
    await client.post(f"/api/orders/{second['id']}/return-requests", json={"kind": "exchange", "reason": "색상"})

    await login(client, "shop-admin@pixelmart.test", admin=True)
    rows = (await client.get("/api/admin/return-requests")).json()["items"]
    by_order = {row["orderId"]: row["id"] for row in rows}
    await client.post(f"/api/admin/return-requests/{by_order[first['id']]}/approve")
    await client.post(f"/api/admin/return-requests/{by_order[second['id']]}/reject")

    await login(client, "shop-exchange@pixelmart.test")
    assert (await client.get(f"/api/orders/{first['id']}")).json()["status"] == "preparing"
    assert (await client.get(f"/api/orders/{second['id']}")).json()["status"] == "delivered"


async def test_return_request_requires_admin_for_list(client):
    await login(client, "shop-user@pixelmart.test")
    assert (await client.get("/api/admin/return-requests")).status_code == 404


# ---- 비밀번호 ----
async def test_password_change_and_reset(client):
    email = "shop-password@pixelmart.test"
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email = :email"), {"email": email})
    signup = await client.post(
        "/api/auth/signup", json={"email": email, "password": "pixel-pass-1", "nickname": "비번테스터"}
    )
    assert signup.status_code == 201
    await client.post("/api/auth/token", data={"username": email, "password": "pixel-pass-1"})

    wrong = await client.post(
        "/api/auth/password", json={"currentPassword": "nope-nope", "newPassword": "pixel-pass-2"}
    )
    assert wrong.status_code == 400
    ok = await client.post(
        "/api/auth/password", json={"currentPassword": "pixel-pass-1", "newPassword": "pixel-pass-2"}
    )
    assert ok.status_code == 200

    reset = (await client.post("/api/auth/password-reset", json={"email": email})).json()
    unknown = (await client.post("/api/auth/password-reset", json={"email": "nobody@pixelmart.test"})).json()
    assert reset["message"] == unknown["message"] and unknown["resetUrl"] is None
    token = reset["resetUrl"].split("token=")[1]
    done = await client.post("/api/auth/password-reset/confirm", json={"token": token, "newPassword": "pixel-pass-3"})
    assert done.status_code == 200
    reused = await client.post("/api/auth/password-reset/confirm", json={"token": token, "newPassword": "pixel-pass-4"})
    assert reused.status_code == 400  # 한 번 쓴 링크는 다시 못 쓴다
    login_res = await client.post("/api/auth/token", data={"username": email, "password": "pixel-pass-3"})
    assert login_res.status_code == 200


# ---- 포토 리뷰 ----
async def test_review_with_photos(client):
    await login(client, "shop-review@pixelmart.test")
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "DELETE FROM reviews WHERE user_id IN (SELECT id FROM users WHERE email = 'shop-review@pixelmart.test')"
            )
        )
    placed = await order(client)
    await deliver(client, placed["id"])
    photo = "data:image/png;base64,iVBORw0KGgo="
    bad = await client.post(
        f"/api/products/{PRODUCT}/reviews", json={"rating": 5, "content": "좋아요", "imageUrls": ["http://x/y.png"]}
    )
    assert bad.status_code == 422
    res = await client.post(
        f"/api/products/{PRODUCT}/reviews", json={"rating": 5, "content": "좋아요", "imageUrls": [photo]}
    )
    assert res.status_code == 201 and res.json()["imageUrls"] == [photo]
    listed = (await client.get(f"/api/products/{PRODUCT}/reviews")).json()["items"]
    assert listed[0]["imageUrls"] == [photo]
