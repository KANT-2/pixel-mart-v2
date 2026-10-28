"""관리자 문의 API (#31) — 목록·검색·답변. 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app
from tests.conftest import headers, login, logout

AUTHOR = "qadmin-author@pixelmart.test"
ADMIN = "qadmin-admin@pixelmart.test"
ADMIN_URL = "/api/admin/questions"


@pytest.fixture
async def products(test_products):
    """이 테스트만 쓰는 상품 2개 (conftest가 만들고 지운다)"""
    return test_products


@pytest.fixture
async def other():
    """다른 사람 (쿠키가 따로인 클라이언트)"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
async def clean_author_questions():
    """공유 DB에 남은 이 작성자의 이전 문의를 지우고 시작 (관리자 목록은 모든 상품을 보여 줘서)"""
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text("DELETE FROM product_questions WHERE user_id IN (SELECT id FROM users WHERE email = :email)"),
                {"email": AUTHOR},
            )
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")


async def ask(client: AsyncClient, token: str, product_id: int, title: str, secret=False) -> dict:
    res = await client.post(
        f"/api/products/{product_id}/questions",
        json={"title": title, "content": f"{title} 내용", "isSecret": secret},
        headers=headers(token),
    )
    assert res.status_code == 201, res.text
    return res.json()


def answer_url(question_id: int) -> str:
    return f"{ADMIN_URL}/{question_id}/answer"


async def mine(client: AsyncClient, admin: str, **params) -> list[dict]:
    """관리자 목록에서 이 테스트 작성자의 문의만 (공유 DB의 다른 문의와 섞이지 않게)"""
    body = (await client.get(ADMIN_URL, params={"size": 60, **params}, headers=headers(admin))).json()
    return [q for q in body["items"] if q["authorNickname"] == "문의관리테스트"]


# 목록 · 검색
async def test_admin_list_shows_secret_content_product_name_and_author(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    await ask(other, author, products[0], "관리자만 보는 비밀", secret=True)
    admin = await login(client, ADMIN, admin=True)

    res = await client.get(ADMIN_URL, headers=headers(admin))
    assert res.status_code == 200
    [q] = await mine(client, admin)
    assert q["hidden"] is False and q["isSecret"] is True
    assert q["title"] == "관리자만 보는 비밀" and q["content"] == "관리자만 보는 비밀 내용"
    assert q["productId"] == products[0] and q["productName"] == "테스트 전용 상품 1"
    assert q["authorNickname"] == "문의관리테스트"


async def test_admin_list_filter_and_search(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    first = await ask(other, author, products[0], "배송 언제 와요")
    await ask(other, author, products[1], "색상 문의")
    admin = await login(client, ADMIN, admin=True)
    await client.post(answer_url(first["id"]), json={"answer": "내일 와요"}, headers=headers(admin))

    assert [q["title"] for q in await mine(client, admin, answered="false")] == ["색상 문의"]
    assert [q["title"] for q in await mine(client, admin, answered="true")] == ["배송 언제 와요"]
    assert [q["title"] for q in await mine(client, admin, q="배송")] == ["배송 언제 와요"]  # 제목 검색
    assert [q["title"] for q in await mine(client, admin, q="상품 2")] == ["색상 문의"]  # 상품 이름 검색
    assert await mine(client, admin, q="100%") == []  # %는 글자 그대로


# 답변
async def test_answer_saves_shows_to_author_and_notifies(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "구성 문의", secret=True)
    admin = await login(client, ADMIN, admin=True)

    res = await client.post(answer_url(asked["id"]), json={"answer": "  상세 탭을 보세요  "}, headers=headers(admin))
    assert res.status_code == 200
    body = res.json()
    assert (body["answered"], body["answer"]) == (True, "상세 탭을 보세요")
    assert body["answeredAt"] is not None

    # 작성자는 상품 상세에서 답변을 본다
    listing = (await other.get(f"/api/products/{products[0]}/questions", headers=headers(author))).json()
    assert listing["items"][0]["answer"] == "상세 탭을 보세요"

    # 작성자 알림함에 도착 (ADMIN_API.md 8장)
    notes = (await other.get("/api/notifications", headers=headers(author))).json()
    items = notes["items"] if isinstance(notes, dict) else notes
    assert any(n["title"] == "문의에 답변이 달렸어요" and n["href"] == f"/products/{products[0]}" for n in items)


async def test_second_answer_is_409_and_keeps_first(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "문의")
    admin = await login(client, ADMIN, admin=True)
    await client.post(answer_url(asked["id"]), json={"answer": "첫 답변"}, headers=headers(admin))

    res = await client.post(answer_url(asked["id"]), json={"answer": "두 번째"}, headers=headers(admin))
    assert (res.status_code, res.json()["detail"]) == (409, "이미 답변한 문의예요.")
    [q] = await mine(client, admin)
    assert q["answer"] == "첫 답변"


@pytest.mark.parametrize("answer", ["", "   ", "가" * 501])
async def test_invalid_answer_is_422_and_nothing_saved(client, other, products, answer):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "문의")
    admin = await login(client, ADMIN, admin=True)
    res = await client.post(answer_url(asked["id"]), json={"answer": answer}, headers=headers(admin))
    assert res.status_code == 422
    [q] = await mine(client, admin)
    assert q["answered"] is False


async def test_answer_unknown_question_is_404(client):
    admin = await login(client, ADMIN, admin=True)
    res = await client.post(answer_url(999_999_999), json={"answer": "답변"}, headers=headers(admin))
    assert res.status_code == 404


# 권한
async def test_non_admin_gets_404(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "문의")
    # 일반 사용자는 관리자 API가 있다는 것도 모르게 404
    assert (await other.get(ADMIN_URL, headers=headers(author))).status_code == 404
    res = await other.post(answer_url(asked["id"]), json={"answer": "내가 답변"}, headers=headers(author))
    assert res.status_code == 404


async def test_anonymous_gets_401(products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anon:
        assert (await anon.get(ADMIN_URL)).status_code == 401
        assert (await anon.post(answer_url(1), json={"answer": "x"})).status_code == 401


async def test_logged_out_admin_token_is_401(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "문의")
    admin = await login(client, ADMIN, admin=True)
    await logout(client, admin)

    assert (await client.get(ADMIN_URL, headers=headers(admin))).status_code == 401
    res = await client.post(answer_url(asked["id"]), json={"answer": "답변"}, headers=headers(admin))
    assert res.status_code == 401
    listing = (await other.get(f"/api/products/{products[0]}/questions")).json()
    assert listing["items"][0]["answered"] is False  # 아무것도 바뀌지 않음


# 관리 — 숨김 · 답변 삭제 · 문의 삭제
async def test_admin_hides_and_shows_question(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "숨김 문의")
    admin = await login(client, ADMIN, admin=True)
    public = f"/api/products/{products[0]}/questions"

    hidden = await client.patch(f"{ADMIN_URL}/{asked['id']}", json={"hidden": True}, headers=headers(admin))
    assert hidden.status_code == 200
    assert asked["id"] not in [q["id"] for q in (await other.get(public)).json()["items"]]
    row = next(q for q in await mine(client, admin, answered="false") if q["id"] == asked["id"])
    assert row["isHidden"] is True  # 관리자 목록에는 남아 숨김 표시
    assert (
        await client.patch(f"{ADMIN_URL}/{asked['id']}", json={"hidden": "yes"}, headers=headers(admin))
    ).status_code == 422

    shown = await client.patch(f"{ADMIN_URL}/{asked['id']}", json={"hidden": False}, headers=headers(admin))
    assert shown.status_code == 200
    assert asked["id"] in [q["id"] for q in (await other.get(public)).json()["items"]]


async def test_admin_deletes_answer_then_answers_again(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "답변 고치기")
    admin = await login(client, ADMIN, admin=True)
    await client.post(answer_url(asked["id"]), json={"answer": "오타 답변"}, headers=headers(admin))

    removed = await client.delete(answer_url(asked["id"]), headers=headers(admin))
    assert removed.status_code == 200
    again = await client.delete(answer_url(asked["id"]), headers=headers(admin))
    assert (again.status_code, again.json()["detail"]) == (409, "아직 답변이 없는 문의예요.")

    fixed = await client.post(answer_url(asked["id"]), json={"answer": "고친 답변"}, headers=headers(admin))
    assert (fixed.status_code, fixed.json()["answer"]) == (200, "고친 답변")


async def test_admin_deletes_answered_question(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "삭제할 문의")
    admin = await login(client, ADMIN, admin=True)
    await client.post(answer_url(asked["id"]), json={"answer": "답변"}, headers=headers(admin))

    assert (await client.delete(f"{ADMIN_URL}/{asked['id']}", headers=headers(admin))).status_code == 200
    assert (await client.delete(f"{ADMIN_URL}/{asked['id']}", headers=headers(admin))).status_code == 404
    assert asked["id"] not in [q["id"] for q in await mine(client, admin, answered="true")]


async def test_moderation_needs_admin(client, other, products):
    author = await login(other, AUTHOR, "문의관리테스트")
    asked = await ask(other, author, products[0], "권한 확인")
    auth = headers(author)
    assert (await other.patch(f"{ADMIN_URL}/{asked['id']}", json={"hidden": True}, headers=auth)).status_code == 404
    assert (await other.delete(answer_url(asked["id"]), headers=auth)).status_code == 404
    assert (await other.delete(f"{ADMIN_URL}/{asked['id']}", headers=auth)).status_code == 404
