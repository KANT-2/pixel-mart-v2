"""배포(ENV=production) 안전 설정 — DB 없이 확인"""

import pytest
from fastapi import Response

from app.core import security
from app.core.config import DEFAULT_JWT_SECRET, Settings, settings
from tests.conftest import headers, login

REAL_SECRET = "deploy-only-secret-for-test-0123456789abcdef"


def test_production_refuses_default_or_short_secret():
    with pytest.raises(RuntimeError, match="JWT_SECRET") as error:
        Settings(env="production", jwt_secret=DEFAULT_JWT_SECRET, _env_file=None).ensure_deployable()
    assert "postgresql" not in str(error.value)  # 오류 문장에 DB 주소 같은 설정값이 섞이지 않음
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        Settings(env="production", jwt_secret="short", _env_file=None).ensure_deployable()


def test_production_accepts_real_secret_and_local_keeps_default():
    assert not Settings(env="production", jwt_secret=REAL_SECRET, _env_file=None).ensure_deployable().is_local
    assert Settings(env="local", jwt_secret=DEFAULT_JWT_SECRET, _env_file=None).ensure_deployable().is_local


@pytest.fixture
def production(monkeypatch):
    monkeypatch.setattr(settings, "env", "production")


async def test_dev_login_and_dev_api_are_404_in_production(client, production):
    assert (await client.post("/api/auth/dev-login", json={"email": "deploy@pixelmart.test"})).status_code == 404
    assert (await client.get("/api/auth/providers")).json()["devLogin"] is False


def test_session_cookie_is_https_only_in_production(production):
    response = Response()
    security.set_session_token(response, "token")
    cookie = response.headers["set-cookie"].lower()
    assert "secure" in cookie and "httponly" in cookie


def test_cloud_database_url_uses_async_driver():
    for raw in ("postgres://u:p@host:5432/db", "postgresql://u:p@host:5432/db"):
        assert Settings(database_url=raw, _env_file=None).database_url == "postgresql+asyncpg://u:p@host:5432/db"
    local = "postgresql+asyncpg://pixelmart:pixelmart@localhost:5432/pixelmart"
    assert Settings(database_url=local, _env_file=None).database_url == local


def test_frontend_host_becomes_https_url():
    assert (
        Settings(frontend_url="pixel-mart.vercel.app", _env_file=None).frontend_url == "https://pixel-mart.vercel.app"
    )
    assert Settings(frontend_url="http://localhost:3000/", _env_file=None).frontend_url == "http://localhost:3000"


async def test_api_docs_open_locally(client):
    assert (await client.get("/api/docs")).status_code == 200
    assert (await client.get("/api/openapi.json")).json()["info"]["title"] == "PIXEL MART API"


async def test_api_docs_admin_only_in_production(client, production):
    # 비로그인 · 일반 사용자 404, 관리자 200 — 개발용 로그인은 production에서 닫히므로 로컬에서 먼저 받아 둔다
    settings.env = "local"
    user = await login(client, "docs-user@pixelmart.test")
    admin = await login(client, "docs-admin@pixelmart.test", admin=True)
    settings.env = "production"
    client.cookies.clear()
    for path in ("/api/docs", "/api/openapi.json"):
        assert (await client.get(path)).status_code == 404
        assert (await client.get(path, headers=headers(user))).status_code == 404
        assert (await client.get(path, headers=headers(admin))).status_code == 200
