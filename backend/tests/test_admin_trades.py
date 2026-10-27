import uuid

import pytest
from sqlalchemy import delete, select, text

from app.core.db import SessionLocal, engine
from app.models import Region, TradePost, User
from src.admin_trades.domain.moderation import CannotReopen, TradeState, moderate, newly_hidden
from tests.conftest import headers, login

# --- 도메인 규칙 (DB 없음) ---


def test_admin_can_reopen_only_what_admin_hid():
    by_admin = TradeState(1, 7, "hidden", hidden_by_admin=True)
    by_writer = TradeState(2, 7, "hidden", hidden_by_admin=False)
    assert moderate(by_admin, "open") == ("open", False)
    assert moderate(by_writer, "hidden") == ("hidden", True)
    with pytest.raises(CannotReopen):
        moderate(by_writer, "open")
    assert newly_hidden(TradeState(3, 7, "open", False), "hidden")
    assert not newly_hidden(by_admin, "hidden")  # 이미 숨긴 글은 알림 다시 안 보냄


# --- API (진짜 DB) ---


@pytest.fixture
async def tag():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT hidden_by_admin FROM trade_posts LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value
    async with SessionLocal() as session:  # 이 테스트가 만든 계정만 (거래글 · 알림은 함께 지워짐)
        await session.execute(delete(User).where(User.email.like(f"admintrades-{value}%@pixelmart.test")))
        await session.commit()


async def writer_with_post(client, tag: str, name: str, status: str = "open") -> tuple[str, int]:
    token = await login(client, f"admintrades-{tag}-{name}@pixelmart.test", f"{name}{tag}")
    client.cookies.clear()
    uid = (await client.get("/api/auth/me", headers=headers(token))).json()["id"]
    async with SessionLocal() as session:
        region = await session.scalar(select(Region.code).limit(1))
        post = TradePost(user_id=uid, region_code=region, kind="want", item_name=f"픽셀 키캡 {tag}", status=status)
        session.add(post)
        await session.commit()
        return token, post.id


async def admin_token(client, tag: str) -> str:
    token = await login(client, f"admintrades-{tag}-boss@pixelmart.test", f"관리{tag}", admin=True)
    client.cookies.clear()
    return token


async def hidden_notices(client, token: str) -> list[dict]:
    res = await client.get("/api/notifications", headers=headers(token))
    return [n for n in res.json()["items"] if n["kind"] == "trade_hidden"]


async def test_admin_hides_and_reopens_trade(client, tag):
    writer, post_id = await writer_with_post(client, tag, "글쓴이")
    admin = await admin_token(client, tag)

    listed = await client.get("/api/admin/trades", params={"q": f"글쓴이{tag}"}, headers=headers(admin))
    assert listed.status_code == 200
    row = listed.json()["items"][0]
    assert row["id"] == post_id
    assert row["authorEmail"] == f"admintrades-{tag}-글쓴이@pixelmart.test"
    assert row["hiddenByAdmin"] is False
    assert all(not r["isSample"] for r in listed.json()["items"])

    for _ in range(2):  # 두 번 숨겨도 알림은 한 번
        hidden = await client.patch(f"/api/admin/trades/{post_id}", json={"status": "hidden"}, headers=headers(admin))
        assert hidden.status_code == 200
    assert hidden.json()["status"] == "hidden" and hidden.json()["hiddenByAdmin"] is True
    notices = await hidden_notices(client, writer)
    assert [n["title"] for n in notices] == ["거래글이 운영 정책으로 숨겨졌어요"]
    assert notices[0]["href"] == "/local/trades/mine"

    # 글쓴이는 관리자가 숨긴 글을 바꿀 수 없음
    mine = await client.patch(f"/api/local/trades/{post_id}", json={"status": "done"}, headers=headers(writer))
    assert mine.status_code == 403
    assert mine.json()["detail"] == "운영 정책으로 숨겨진 글이에요."

    only_hidden = await client.get("/api/admin/trades", params={"status": "hidden", "q": tag}, headers=headers(admin))
    assert [r["id"] for r in only_hidden.json()["items"]] == [post_id]

    reopened = await client.patch(f"/api/admin/trades/{post_id}", json={"status": "open"}, headers=headers(admin))
    assert reopened.json()["status"] == "open" and reopened.json()["hiddenByAdmin"] is False


async def test_admin_trade_failures(client, tag):
    writer, self_hidden = await writer_with_post(client, tag, "숨긴이", status="hidden")
    admin = await admin_token(client, tag)

    res = await client.patch(f"/api/admin/trades/{self_hidden}", json={"status": "open"}, headers=headers(admin))
    assert res.status_code == 400
    assert res.json()["detail"] == "글쓴이가 직접 숨긴 글은 다시 열 수 없어요."

    missing = await client.patch("/api/admin/trades/999999999", json={"status": "hidden"}, headers=headers(admin))
    assert missing.status_code == 404
    bad = await client.patch(f"/api/admin/trades/{self_hidden}", json={"status": "done"}, headers=headers(admin))
    assert bad.status_code == 422

    assert (await client.get("/api/admin/trades", headers=headers(writer))).status_code == 404
    assert (await client.get("/api/admin/trades")).status_code == 401
