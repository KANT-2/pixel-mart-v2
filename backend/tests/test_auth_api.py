import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, text, update
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models import User
from src.auth.infrastructure.jwt import decode_token
from src.auth.infrastructure.models import TokenBlacklist
from src.auth.presentation.router import router as auth_router
from src.common.auth import AdminUser
from src.common.errors import domain_error_handler
from src.main import app as main_app

PASSWORD = "pixel-pass-1"


@pytest.fixture
async def ctx():
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM token_blacklist LIMIT 1"))
    except Exception:
        await engine.dispose()
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    tag = uuid.uuid4().hex[:8]
    jtis: list[str] = []
    yield engine, tag, jtis
    async with engine.begin() as conn:  # 이 테스트가 만든 줄만 지운다
        await conn.execute(delete(TokenBlacklist).where(TokenBlacklist.jti.in_(jtis)))
        await conn.execute(delete(User).where(User.email.like(f"authapi-{tag}%@pixelmart.test")))
    await engine.dispose()


async def signup_and_login(client: AsyncClient, tag: str, jtis: list[str], suffix: str = "") -> str:
    email = f"authapi-{tag}{suffix}@pixelmart.test"
    res = await client.post(
        "/api/auth/signup", json={"email": email, "password": PASSWORD, "nickname": f"탐{tag}{suffix}"}
    )
    assert res.status_code == 201, res.text
    assert res.json()["role"] == "user"
    res = await client.post("/api/auth/token", data={"username": email, "password": PASSWORD})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token_type"] == "bearer"
    jtis.append(decode_token(body["access_token"]).jti)
    return body["access_token"]


async def test_bearer_login_me_logout_then_same_token_is_401(client, ctx):
    _, tag, jtis = ctx
    token = await signup_and_login(client, tag, jtis)
    client.cookies.clear()  # 헤더만으로 확인
    auth = {"Authorization": f"Bearer {token}"}

    me = await client.get("/api/auth/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["email"] == f"authapi-{tag}@pixelmart.test"
    assert me.json()["role"] == "user"

    assert (await client.post("/api/auth/logout", headers=auth)).status_code == 200
    again = await client.get("/api/auth/me", headers=auth)
    assert again.status_code == 401
    assert again.json()["detail"] == "다시 로그인해 주세요."


async def test_cookie_login_is_blocked_after_logout_too(client, ctx):
    _, tag, jtis = ctx
    token = await signup_and_login(client, tag, jtis)
    assert client.cookies.get("pm_session") == token  # 로그인 응답이 쿠키도 심어 줌

    assert (await client.get("/api/auth/me")).status_code == 200
    assert (await client.post("/api/auth/logout")).status_code == 200
    # 쿠키를 지워도 누가 복사해 둔 같은 토큰을 쿠키로 다시 보내면 401
    client.cookies.set("pm_session", token)
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_logout_twice_and_without_token_is_fine(client, ctx):
    _, tag, jtis = ctx
    token = await signup_and_login(client, tag, jtis)
    auth = {"Authorization": f"Bearer {token}"}
    assert (await client.post("/api/auth/logout", headers=auth)).status_code == 200
    assert (await client.post("/api/auth/logout", headers=auth)).status_code == 200
    client.cookies.clear()
    assert (await client.post("/api/auth/logout")).status_code == 200


async def test_dev_login_token_is_blocked_after_logout(client, ctx):
    _, tag, jtis = ctx
    res = await client.post("/api/auth/dev-login", json={"email": f"authapi-{tag}-dev@pixelmart.test"})
    assert res.status_code == 200
    token = client.cookies.get("pm_session")
    jtis.append(decode_token(token).jti)  # dev-login 토큰에도 jti가 있다

    assert (await client.post("/api/auth/logout")).status_code == 200
    client.cookies.set("pm_session", token)
    assert (await client.get("/api/auth/me")).status_code == 401
    # 기존 라우터(app/deps.py)도 같은 검사원을 쓴다
    assert (await client.get("/api/cart")).status_code == 401


async def test_signup_and_login_failures(client, ctx):
    _, tag, jtis = ctx
    await signup_and_login(client, tag, jtis)
    email = f"authapi-{tag}@pixelmart.test"

    dup = await client.post("/api/auth/signup", json={"email": email.upper(), "password": PASSWORD, "nickname": "다른"})
    assert dup.status_code == 409
    assert dup.json()["detail"] == "이미 가입한 이메일이에요."

    short = await client.post(
        "/api/auth/signup", json={"email": f"authapi-{tag}b@pixelmart.test", "password": "1234567", "nickname": "짧"}
    )
    assert short.status_code == 422

    wrong = await client.post("/api/auth/token", data={"username": email, "password": "wrong-pass-1"})
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "이메일 또는 비밀번호가 맞지 않아요."


async def test_no_token_and_garbage_token_are_401(client, ctx):
    client.cookies.clear()
    assert (await client.get("/api/auth/me")).status_code == 401
    garbage = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert garbage.status_code == 401


async def test_admin_user_hides_admin_api_with_404(ctx):
    engine, tag, jtis = ctx
    test_app = FastAPI()
    test_app.include_router(auth_router, prefix="/api")
    for error, handler in main_app.exception_handlers.items():
        if handler is domain_error_handler:
            test_app.add_exception_handler(error, handler)

    @test_app.get("/api/admin/ping")
    async def ping(admin: AdminUser):
        return {"admin": admin.id}

    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as c:
        token = await signup_and_login(c, tag, jtis)
        auth = {"Authorization": f"Bearer {token}"}
        assert (await c.get("/api/admin/ping", headers=auth)).status_code == 404  # 일반 사용자

        async with engine.begin() as conn:
            await conn.execute(update(User).where(User.email == f"authapi-{tag}@pixelmart.test").values(role="admin"))
        assert (await c.get("/api/admin/ping", headers=auth)).status_code == 200
        assert (await c.get("/api/auth/me", headers=auth)).json()["role"] == "admin"

        c.cookies.clear()
        assert (await c.get("/api/admin/ping")).status_code == 401  # 비로그인
