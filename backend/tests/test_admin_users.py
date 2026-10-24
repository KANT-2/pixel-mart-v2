import uuid

import pytest
from sqlalchemy import delete, text

from app.core.db import SessionLocal, engine
from app.models import User
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
    assert set(first) == {"id", "email", "nickname", "role", "signupMethod", "createdAt"}  # 주소·전화 없음
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
