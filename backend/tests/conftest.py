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


@pytest.fixture
async def test_products():
    """시연용 리뷰·문의가 붙은 상품과 섞이지 않게, 이 테스트만 쓰는 상품 2개를 만들고 끝나면 지운다.

    공유 DB에 seed_demo · seed_showcase 데이터가 있어도 "이 상품의 리뷰는 0개" 같은 가정이 깨지지 않아요.
    """
    from sqlalchemy import text

    from app.core.db import engine

    try:
        async with engine.begin() as conn:
            slug = await conn.scalar(text("SELECT slug FROM categories ORDER BY sort_order LIMIT 1"))
            if slug is None:
                raise LookupError("카테고리 없음")
            ids = []
            for n in (1, 2):
                row = await conn.execute(
                    text(
                        "INSERT INTO products (name, price, stock, category_slug, image_url, description, is_new) "
                        "VALUES (:name, 12000, 999, :slug, '/images/products/test-only.png', '테스트 전용', false) "
                        "RETURNING id"
                    ),
                    {"name": f"테스트 전용 상품 {n}", "slug": slug},
                )
                ids.append(row.scalar_one())
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다 (alembic upgrade head → python -m scripts.seed)")
    yield ids
    async with engine.begin() as conn:
        # 주문 품목은 상품을 지워도 남는 칸이라(CASCADE 아님) 이 상품이 든 주문을 먼저 지운다 — 테스트 계정 주문만 해당
        await conn.execute(
            text("DELETE FROM orders WHERE id IN (SELECT order_id FROM order_items WHERE product_id = ANY(:ids))"),
            {"ids": ids},
        )
        await conn.execute(text("DELETE FROM products WHERE id = ANY(:ids)"), {"ids": ids})


async def logout(client: AsyncClient, token: str) -> None:
    """그 토큰을 블랙리스트에 올리고 쿠키를 지운다. 이후 같은 토큰은 401"""
    res = await client.post("/api/auth/logout", headers=headers(token))
    assert res.status_code == 200, res.text
