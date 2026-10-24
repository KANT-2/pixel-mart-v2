"""배포(ENV=production) 안전 설정 — DB 없이 확인"""

import pytest
from fastapi import Response

from app.core import security
from app.core.config import DEFAULT_JWT_SECRET, Settings, settings

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
