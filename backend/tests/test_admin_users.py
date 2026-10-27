import uuid

import pytest
from sqlalchemy import delete, select, text, update

from app.core.db import SessionLocal, engine
from app.models import Order, Product, ProductQuestion, User
from tests.conftest import headers, login, logout


@pytest.fixture
async def tag():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM token_blacklist LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value
    async with SessionLocal() as session:  # 이 테스트가 만든 계정만 지운다
        await session.execute(delete(User).where(User.email.like(f"adminusers-{value}%@pixelmart.test")))
        await session.commit()


async def admin_token(client, tag: str) -> str:
    token = await login(client, f"adminusers-{tag}-boss@pixelmart.test", f"관리{tag}", admin=True)
    client.cookies.clear()
    return token


async def test_search_filter_and_pages(client, tag):
    for i in range(3):
        await login(client, f"adminusers-{tag}-m{i}@pixelmart.test", f"회원{tag}{i}")
    token = await admin_token(client, tag)

    res = await client.get("/api/admin/users", params={"q": f"회원{tag}"}, headers=headers(token))
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 3
    first = body["items"][0]
    assert set(first) == {
        "id",
        "email",
        "nickname",
        "role",
        "signupMethod",
        "createdAt",
        "avatarUrl",
        "suspended",
        "withdrawn",
        "orderCount",
        "reportCount",
    }  # 주소·전화 없음
    assert first["signupMethod"] == "email"

    by_email = await client.get("/api/admin/users", params={"q": f"adminusers-{tag}-M1"}, headers=headers(token))
    assert [u["nickname"] for u in by_email.json()["items"]] == [f"회원{tag}1"]  # 이메일도 대소문자 무시

    page2 = await client.get("/api/admin/users", params={"q": tag, "size": 2, "page": 2}, headers=headers(token))
    assert page2.json()["total"] == 4  # 회원 3 + 관리자 1
    assert len(page2.json()["items"]) == 2
    assert page2.json()["totalPages"] == 2

    admins = await client.get("/api/admin/users", params={"q": tag, "role": "admin"}, headers=headers(token))
    assert [u["role"] for u in admins.json()["items"]] == ["admin"]


async def test_like_wildcards_are_plain_text(client, tag):
    token = await admin_token(client, tag)
    res = await client.get("/api/admin/users", params={"q": "%"}, headers=headers(token))
    assert all("%" in u["nickname"] or "%" in u["email"] for u in res.json()["items"])


async def test_bad_role_is_422(client, tag):
    token = await admin_token(client, tag)
    assert (await client.get("/api/admin/users", params={"role": "boss"}, headers=headers(token))).status_code == 422


async def test_normal_user_gets_404(client, tag):
    token = await login(client, f"adminusers-{tag}-user@pixelmart.test", f"일반{tag}")
    client.cookies.clear()
    assert (await client.get("/api/admin/users", headers=headers(token))).status_code == 404


async def test_logged_out_admin_token_is_401(client, tag):
    token = await admin_token(client, tag)
    assert (await client.get("/api/admin/users", headers=headers(token))).status_code == 200
    await logout(client, token)
    assert (await client.get("/api/admin/users", headers=headers(token))).status_code == 401


AVATAR = "data:image/png;base64,iVBORw0KGgo="  # 테스트용 짧은 값 (화면에 그릴 일 없음)


async def give_avatar(email: str, url: str = AVATAR) -> None:
    async with SessionLocal() as session:
        await session.execute(update(User).where(User.email == email).values(avatar_url=url))
        await session.commit()


async def avatar_notices(client, token: str) -> list[dict]:
    res = await client.get("/api/notifications", headers=headers(token))
    return [n for n in res.json()["items"] if n["kind"] == "avatar_reset"]


async def test_admin_resets_avatar_and_owner_is_notified_once(client, tag):
    email = f"adminusers-{tag}-pic@pixelmart.test"
    member = await login(client, email, f"그림{tag}")
    client.cookies.clear()
    await give_avatar(email)
    me = (await client.get("/api/auth/me", headers=headers(member))).json()
    token = await admin_token(client, tag)

    res = await client.post(
        f"/api/admin/users/{me['id']}/avatar-reset", json={"memo": "수위 초과"}, headers=headers(token)
    )
    assert res.status_code == 200
    assert res.json()["avatarUrl"] is None
    assert res.json()["nickname"] == f"그림{tag}"
    assert (await client.get("/api/auth/me", headers=headers(member))).json()["avatarUrl"] is None

    notices = await avatar_notices(client, member)
    assert len(notices) == 1
    assert notices[0]["title"] == "아바타가 기본 모습으로 바뀌었어요"
    assert notices[0]["body"] == "사유: 수위 초과"
    assert notices[0]["href"] == "/mypage/avatar"

    # 이미 기본 모습이면 그대로 200, 알림은 늘지 않음
    again = await client.post(f"/api/admin/users/{me['id']}/avatar-reset", headers=headers(token))
    assert again.status_code == 200
    assert len(await avatar_notices(client, member)) == 1


async def test_avatar_reset_needs_admin_and_existing_member(client, tag):
    email = f"adminusers-{tag}-pic2@pixelmart.test"
    member = await login(client, email, f"그림이{tag}")
    client.cookies.clear()
    await give_avatar(email)
    me = (await client.get("/api/auth/me", headers=headers(member))).json()

    # 일반 회원은 관리자 API가 있는지도 모르게 404, 아바타도 그대로
    res = await client.post(f"/api/admin/users/{me['id']}/avatar-reset", headers=headers(member))
    assert res.status_code == 404
    assert (await client.get("/api/auth/me", headers=headers(member))).json()["avatarUrl"] == AVATAR

    token = await admin_token(client, tag)
    missing = await client.post("/api/admin/users/999999999/avatar-reset", headers=headers(token))
    assert missing.status_code == 404
    assert missing.json()["detail"] == "회원을 찾을 수 없어요."

    too_long = await client.post(
        f"/api/admin/users/{me['id']}/avatar-reset", json={"memo": "가" * 201}, headers=headers(token)
    )
    assert too_long.status_code == 422


async def member_id(client, token: str) -> int:
    return (await client.get("/api/auth/me", headers=headers(token))).json()["id"]


async def ask(client, token: str):
    async with SessionLocal() as session:
        product_id = await session.scalar(select(Product.id).limit(1))
    return await client.post(
        f"/api/products/{product_id}/questions",
        json={"title": "재입고 언제?", "content": "궁금해요"},
        headers=headers(token),
    )


async def test_suspended_user_can_look_but_not_write(client, tag):
    member = await login(client, f"adminusers-{tag}-bad@pixelmart.test", f"정지{tag}")
    client.cookies.clear()
    uid = await member_id(client, member)
    token = await admin_token(client, tag)

    res = await client.patch(f"/api/admin/users/{uid}", json={"suspended": True}, headers=headers(token))
    assert res.status_code == 200
    assert res.json()["suspended"] is True

    assert (await client.get("/api/auth/me", headers=headers(member))).status_code == 200  # 로그인 · 구경은 됨
    blocked = await ask(client, member)
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "이용이 정지된 계정이에요."

    only = await client.get("/api/admin/users", params={"q": tag, "suspended": True}, headers=headers(token))
    assert [u["id"] for u in only.json()["items"]] == [uid]

    res = await client.patch(f"/api/admin/users/{uid}", json={"suspended": False}, headers=headers(token))
    assert res.json()["suspended"] is False
    created = await ask(client, member)
    assert created.status_code == 201
    async with SessionLocal() as session:  # 이 테스트가 쓴 문의 정리
        await session.execute(delete(ProductQuestion).where(ProductQuestion.id == created.json()["id"]))
        await session.commit()


async def test_cannot_suspend_self_admin_or_withdrawn(client, tag):
    token = await admin_token(client, tag)
    me = await member_id(client, token)
    other_admin = await login(client, f"adminusers-{tag}-boss2@pixelmart.test", f"관리둘{tag}", admin=True)
    client.cookies.clear()
    gone = await login(client, f"adminusers-{tag}-gone@pixelmart.test", f"떠남{tag}")
    client.cookies.clear()
    gone_id = await member_id(client, gone)
    assert (
        await client.post("/api/users/me/withdraw", json={"confirm": "탈퇴"}, headers=headers(gone))
    ).status_code == 200

    cases = [
        (me, "자기 자신은 정지할 수 없어요."),
        (await member_id(client, other_admin), "관리자 계정은 정지할 수 없어요."),
        (gone_id, "탈퇴한 계정은 정지할 수 없어요."),
    ]
    for uid, message in cases:
        res = await client.patch(f"/api/admin/users/{uid}", json={"suspended": True}, headers=headers(token))
        assert res.status_code == 400
        assert res.json()["detail"] == message
    missing = await client.patch("/api/admin/users/999999999", json={"suspended": True}, headers=headers(token))
    assert missing.status_code == 404

    async with SessionLocal() as session:  # 탈퇴 계정은 이메일이 바뀌어 id로 정리
        await session.execute(delete(User).where(User.id == gone_id))
        await session.commit()


async def test_list_shows_order_count_and_hides_withdrawn_email(client, tag):
    member = await login(client, f"adminusers-{tag}-buyer@pixelmart.test", f"구매{tag}")
    client.cookies.clear()
    uid = await member_id(client, member)
    async with SessionLocal() as session:
        session.add(Order(user_id=uid, status="delivered", total_price=1000, recipient_name="테스트", address="테스트"))
        await session.commit()
    token = await admin_token(client, tag)
    rows = (await client.get("/api/admin/users", params={"q": f"구매{tag}"}, headers=headers(token))).json()["items"]
    assert rows[0]["orderCount"] == 1 and rows[0]["reportCount"] == 0

    assert (
        await client.post("/api/users/me/withdraw", json={"confirm": "탈퇴"}, headers=headers(member))
    ).status_code == 200
    rows = (await client.get("/api/admin/users", params={"q": f"탈퇴#{uid}"}, headers=headers(token))).json()["items"]
    assert rows[0]["email"] == "탈퇴한 계정" and rows[0]["withdrawn"] is True
    async with SessionLocal() as session:
        await session.execute(delete(User).where(User.id == uid))
        await session.commit()


async def test_logged_out_or_normal_user_cannot_suspend(client, tag):
    member = await login(client, f"adminusers-{tag}-u2@pixelmart.test", f"평범{tag}")
    client.cookies.clear()
    uid = await member_id(client, member)
    res = await client.patch(f"/api/admin/users/{uid}", json={"suspended": True}, headers=headers(member))
    assert res.status_code == 404
    assert (await client.patch(f"/api/admin/users/{uid}", json={"suspended": True})).status_code == 401
