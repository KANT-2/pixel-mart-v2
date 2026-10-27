"""손님 문의 API (#30) — 목록·쓰기·삭제. 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app
from tests.conftest import headers, login, logout

AUTHOR = "qapi-author@pixelmart.test"
OTHER = "qapi-other@pixelmart.test"


@pytest.fixture
async def product(test_products):
    """이 테스트만 쓰는 상품 (conftest가 만들고 지운다)"""
    return test_products[0]


@pytest.fixture
async def anon():
    """로그인하지 않은 방문자 (쿠키가 따로인 클라이언트)"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def url(product_id: int) -> str:
    return f"/api/products/{product_id}/questions"


async def ask(client: AsyncClient, token: str, product_id: int, title="배송 문의", secret=False) -> dict:
    res = await client.post(
        url(product_id), json={"title": title, "content": "언제 와요?", "isSecret": secret}, headers=headers(token)
    )
    assert res.status_code == 201, res.text
    return res.json()


async def mark_answered(question_id: int) -> None:
    """관리자 답변 API(#31) 전이라 DB에 직접 답변을 넣는다"""
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE product_questions SET answer = '답변', answered_at = now() WHERE id = :id"),
            {"id": question_id},
        )


# 쓰기
async def test_write_then_list_shows_it(client, product):
    token = await login(client, AUTHOR)
    created = await ask(client, token, product)
    assert created["title"] == "배송 문의" and created["isMine"] is True and created["answered"] is False

    res = await client.get(url(product))  # 새 요청 = 새로고침
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1 and body["size"] == 20  # 계약: size 기본 20
    assert body["items"][0]["id"] == created["id"]


async def test_write_requires_login(anon, product):
    res = await anon.post(url(product), json={"title": "제목", "content": "내용"})
    assert res.status_code == 401


@pytest.mark.parametrize(
    "payload",
    [{"title": "", "content": "내용"}, {"title": "   ", "content": "내용"}, {"title": "가" * 101, "content": "내용"}],
)
async def test_invalid_title_is_422_and_nothing_saved(client, product, payload):
    token = await login(client, AUTHOR)
    res = await client.post(url(product), json=payload, headers=headers(token))
    assert res.status_code == 422
    assert (await client.get(url(product))).json()["total"] == 0


async def test_unknown_product_is_404(client):
    token = await login(client, AUTHOR)
    res = await client.post(url(999_999_999), json={"title": "제목", "content": "내용"}, headers=headers(token))
    assert (res.status_code, res.json()["detail"]) == (404, "상품을 찾을 수 없어요.")
    assert (await client.get(url(999_999_999))).status_code == 404


# 목록 — 비밀글 · 필터 · 페이지
async def test_others_secret_question_is_masked(client, anon, product):
    token = await login(client, AUTHOR)
    await ask(client, token, product, title="비밀 제목", secret=True)

    [mine] = (await client.get(url(product), headers=headers(token))).json()["items"]
    assert mine["title"] == "비밀 제목" and mine["hidden"] is False

    [masked] = (await anon.get(url(product))).json()["items"]
    assert masked["hidden"] is True and masked["isSecret"] is True
    assert (masked["title"], masked["content"], masked["nickname"]) == (None, None, None)

    other = await login(anon, OTHER)
    [masked] = (await anon.get(url(product), headers=headers(other))).json()["items"]
    assert masked["hidden"] is True and "비밀 제목" not in str(masked)


async def test_answered_filter_and_paging(client, product):
    token = await login(client, AUTHOR)
    ids = [(await ask(client, token, product, title=f"문의 {n}"))["id"] for n in range(3)]
    await mark_answered(ids[0])

    answered = (await client.get(url(product), params={"answered": "true"})).json()
    waiting = (await client.get(url(product), params={"answered": "false"})).json()
    assert [q["id"] for q in answered["items"]] == [ids[0]]
    assert waiting["total"] == 2 and all(not q["answered"] for q in waiting["items"])

    page2 = (await client.get(url(product), params={"page": 2, "size": 2})).json()
    assert (page2["total"], page2["totalPages"], len(page2["items"])) == (3, 2, 1)
    assert page2["items"][0]["id"] == ids[0]  # 최신순이라 가장 먼저 쓴 문의가 2페이지


async def test_list_excludes_hidden_questions(client, product):
    token = await login(client, AUTHOR)
    visible = await ask(client, token, product, title="공개 문의")
    hidden = await ask(client, token, product, title="숨긴 문의")

    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE product_questions SET is_hidden = TRUE WHERE id = :question_id"),
            {"question_id": hidden["id"]},
        )

    body = (await client.get(url(product))).json()
    assert body["total"] == 1
    assert [item["id"] for item in body["items"]] == [visible["id"]]


async def test_oversized_page_is_422(client, product):
    assert (await client.get(url(product), params={"size": 61})).status_code == 422


# 삭제
async def test_author_deletes_own_question(client, product):
    token = await login(client, AUTHOR)
    created = await ask(client, token, product)
    res = await client.delete(f"/api/questions/{created['id']}", headers=headers(token))
    assert (res.status_code, res.json()) == (200, {"message": "문의를 삭제했어요."})
    assert (await client.get(url(product))).json()["total"] == 0


async def test_other_user_delete_is_404(client, anon, product):
    token = await login(client, AUTHOR)
    created = await ask(client, token, product)
    other = await login(anon, OTHER)
    res = await anon.delete(f"/api/questions/{created['id']}", headers=headers(other))
    assert res.status_code == 404
    assert (await client.get(url(product))).json()["total"] == 1


async def test_answered_question_delete_is_409(client, product):
    token = await login(client, AUTHOR)
    created = await ask(client, token, product)
    await mark_answered(created["id"])
    res = await client.delete(f"/api/questions/{created['id']}", headers=headers(token))
    assert (res.status_code, res.json()["detail"]) == (409, "답변이 달린 문의는 삭제할 수 없어요.")


async def test_delete_requires_login(anon, product):
    assert (await anon.delete("/api/questions/1")).status_code == 401


# 로그아웃한 토큰 401 (발제 필수)
async def test_logged_out_token_cannot_write_or_delete(client, product):
    token = await login(client, AUTHOR)
    created = await ask(client, token, product)
    await logout(client, token)

    res = await client.post(url(product), json={"title": "제목", "content": "내용"}, headers=headers(token))
    assert res.status_code == 401
    res = await client.delete(f"/api/questions/{created['id']}", headers=headers(token))
    assert res.status_code == 401
    assert (await client.get(url(product))).json()["total"] == 1  # 아무것도 바뀌지 않음
