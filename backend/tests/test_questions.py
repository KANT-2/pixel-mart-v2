"""상품 문의(Q&A) API — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app
from app.schemas.question import is_hidden

# 테스트 전용 상품 두 개 (conftest의 test_products — 시연용 문의와 섞이지 않게)
PRODUCT = 0
OTHER = 0
AUTHOR = "question1@pixelmart.test"
VISITOR = "question2@pixelmart.test"


@pytest.fixture(autouse=True)
async def require_db(test_products):
    global PRODUCT, OTHER
    PRODUCT, OTHER = test_products
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM product_questions LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")
    # 재실행해도 같은 결과가 나오도록 이 테스트 계정의 이전 문의를 지우고 시작
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "DELETE FROM product_questions WHERE user_id IN "
                "(SELECT id FROM users WHERE email LIKE 'question%@pixelmart.test')"
            )
        )


@pytest.fixture
async def anon():
    """로그인하지 않은 방문자 (쿠키가 따로인 클라이언트)"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def login(client: AsyncClient, email: str) -> None:
    res = await client.post("/api/auth/dev-login", json={"email": email})
    assert res.status_code == 200


def url(product_id: int | None = None) -> str:
    return f"/api/products/{product_id or PRODUCT}/questions"


async def ask(client: AsyncClient, title: str = "구성이 궁금해요", content: str = "구성품 알려 주세요", secret=False):
    res = await client.post(url(), json={"title": title, "content": content, "isSecret": secret})
    assert res.status_code == 201
    return res.json()


async def listing(client: AsyncClient, **params) -> list[dict]:
    return (await client.get(url(), params=params)).json()["items"]


# ---- 순수 함수 (DB 없이) ----
@pytest.mark.parametrize(
    ("is_secret", "owner_id", "viewer_id", "expected"),
    [
        (False, 1, None, False),  # 공개글은 누구에게나 보인다
        (False, 1, 2, False),
        (True, 1, None, True),  # 비밀글은 비로그인에게 가려진다
        (True, 1, 2, True),  # 다른 사람에게도 가려진다
        (True, 1, 1, False),  # 작성자 본인에게만 보인다
    ],
)
def test_is_hidden(is_secret, owner_id, viewer_id, expected):
    assert is_hidden(SimpleNamespace(is_secret=is_secret, user_id=owner_id), viewer_id) is expected


# ---- 목록 ----
async def test_list_is_public_and_empty(anon):
    res = await anon.get(url())
    assert res.status_code == 200
    assert res.json()["items"] == []
    assert res.json()["total"] == 0


async def test_list_unknown_product_is_404(anon):
    assert (await anon.get(url(999999))).status_code == 404


async def test_list_rejects_oversized_page(anon):
    assert (await anon.get(url(), params={"size": 100})).status_code == 422


async def test_list_newest_first_and_paging(client):
    await login(client, AUTHOR)
    await ask(client, "첫 질문")
    await ask(client, "둘째 질문")
    items = await listing(client)
    assert [q["title"] for q in items] == ["둘째 질문", "첫 질문"]
    page2 = (await client.get(url(), params={"page": 2, "size": 1})).json()
    assert [q["title"] for q in page2["items"]] == ["첫 질문"]
    assert page2["total"] == 2
    assert page2["totalPages"] == 2


async def test_list_shows_only_that_products_questions(client):
    await login(client, AUTHOR)
    await ask(client)
    assert (await client.get(url(OTHER))).json()["total"] == 0


# ---- 작성 ----
async def test_post_requires_login(anon):
    assert (await anon.post(url(), json={"title": "a", "content": "b"})).status_code == 401


async def test_post_unknown_product_is_404(client):
    await login(client, AUTHOR)
    assert (await client.post(url(999999), json={"title": "a", "content": "b"})).status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "", "content": "b"},
        {"title": "   ", "content": "b"},
        {"title": "a", "content": ""},
        {"title": "a", "content": "   "},
        {"title": "가" * 101, "content": "b"},
        {"title": "a", "content": "가" * 501},
        {"content": "제목 없음"},
        {"title": "내용 없음"},
    ],
)
async def test_invalid_input_is_422_and_nothing_saved(client, payload):
    await login(client, AUTHOR)
    assert (await client.post(url(), json=payload)).status_code == 422
    assert (await client.get(url())).json()["total"] == 0


async def test_post_creates_public_question_by_default(client):
    await login(client, AUTHOR)
    res = await client.post(url(), json={"title": "  제목  ", "content": "  내용  "})
    body = res.json()
    assert res.status_code == 201
    assert body["title"] == "제목"
    assert body["content"] == "내용"
    assert body["isSecret"] is False
    assert body["hidden"] is False
    assert body["answered"] is False
    assert body["answer"] is None
    assert body["isMine"] is True
    assert body["productId"] == PRODUCT


async def test_post_accepts_boundary_lengths(client):
    await login(client, AUTHOR)
    res = await client.post(url(), json={"title": "가" * 100, "content": "나" * 500})
    assert res.status_code == 201


# ---- 비밀글 가리기 ----
async def test_secret_question_is_masked_for_anonymous(client, anon):
    await login(client, AUTHOR)
    await ask(client, "비밀 제목", "비밀 내용", secret=True)
    [q] = await listing(anon)
    assert q["hidden"] is True
    assert q["isSecret"] is True
    assert q["title"] is None
    assert q["content"] is None
    assert q["nickname"] is None
    assert q["answer"] is None
    assert q["isMine"] is False


async def test_secret_question_is_masked_for_other_user(client):
    await login(client, AUTHOR)
    await ask(client, "비밀 제목", "비밀 내용", secret=True)
    await login(client, VISITOR)
    [q] = await listing(client)
    assert q["hidden"] is True
    assert q["title"] is None
    assert q["content"] is None
    assert q["isMine"] is False


async def test_secret_question_is_visible_to_author(client):
    await login(client, AUTHOR)
    await ask(client, "비밀 제목", "비밀 내용", secret=True)
    [q] = await listing(client)
    assert q["hidden"] is False
    assert q["title"] == "비밀 제목"
    assert q["content"] == "비밀 내용"
    assert q["isMine"] is True


async def test_public_question_is_visible_to_everyone(client, anon):
    await login(client, AUTHOR)
    await ask(client, "공개 제목", "공개 내용")
    [q] = await listing(anon)
    assert q["hidden"] is False
    assert q["title"] == "공개 제목"
    assert q["nickname"] is not None


async def test_masked_output_never_contains_secret_text(client, anon):
    await login(client, AUTHOR)
    await ask(client, "절대노출금지제목", "절대노출금지내용", secret=True)
    raw = (await anon.get(url())).text
    assert "절대노출금지" not in raw


# 답변 테스트는 관리자 답변 API로 옮겼어요 → tests/test_admin_questions_api.py (#31)
