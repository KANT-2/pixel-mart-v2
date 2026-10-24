"""팀 공용 로그인 도우미 사용 예시 — 내 API 테스트에 이 모양 그대로 복사해 쓰면 돼요"""

import pytest
from sqlalchemy import text

from app.core.db import engine
from tests.conftest import headers, login, logout


@pytest.fixture(autouse=True)
async def need_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM token_blacklist LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")


async def test_logged_out_token_is_401_on_my_api(client):
    token = await login(client, "helper-example@pixelmart.test", "도우미예시")
    client.cookies.clear()  # 헤더만으로 확인

    # 내 보호 API (기사: /api/orders · 궁수: /api/admin/orders · 마법사: 문의 쓰기)
    assert (await client.get("/api/cart", headers=headers(token))).status_code == 200

    await logout(client, token)
    assert (await client.get("/api/cart", headers=headers(token))).status_code == 401


async def test_admin_login(client):
    token = await login(client, "helper-admin@pixelmart.test", "도우미관리자", admin=True)
    me = await client.get("/api/auth/me", headers=headers(token))
    assert me.json()["role"] == "admin"
    await logout(client, token)
