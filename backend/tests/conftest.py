import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# --- 로그인 도우미 (팀 공용) ---
# from tests.conftest import headers, login, logout
#
#     token = await login(client, "buyer@pixelmart.test")
#     assert (await client.get("/api/orders", headers=headers(token))).status_code == 200
#     await logout(client, token)
#     assert (await client.get("/api/orders", headers=headers(token))).status_code == 401


def headers(token: str) -> dict[str, str]:
    """Authorization: Bearer 헤더"""
    return {"Authorization": f"Bearer {token}"}


async def login(client: AsyncClient, email: str, nickname: str | None = None, *, admin: bool = False) -> str:
    """테스트 계정으로 로그인하고 토큰(jti 포함 JWT)을 돌려준다. 없는 계정이면 만든다.

    - 이메일은 *@pixelmart.test 만 (실제 메일 주소 금지)
    - 쿠키(pm_session)도 함께 심긴다. 헤더로만 확인하려면 client.cookies.clear()
    - admin=True면 그 계정을 관리자로 바꾼다 (AdminUser API 테스트용)
    """
    assert email.endswith("@pixelmart.test"), "테스트 계정은 *@pixelmart.test 만 써요"
    body = {"email": email, **({"nickname": nickname} if nickname else {})}
    res = await client.post("/api/auth/dev-login", json=body)
    assert res.status_code == 200, res.text
    if admin:
        from sqlalchemy import update

        from app.core.db import SessionLocal
        from app.models import User

        async with SessionLocal() as session:
            await session.execute(update(User).where(User.email == email).values(role="admin"))
            await session.commit()
    return client.cookies["pm_session"]


async def logout(client: AsyncClient, token: str) -> None:
    """그 토큰을 블랙리스트에 올리고 쿠키를 지운다. 이후 같은 토큰은 401"""
    res = await client.post("/api/auth/logout", headers=headers(token))
    assert res.status_code == 200, res.text
