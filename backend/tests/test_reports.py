import uuid

import pytest
from sqlalchemy import delete, select, text, update

from app.core.db import SessionLocal, engine
from app.models import Product, ProductQuestion, User
from src.reports.domain.exceptions import CannotReport
from src.reports.domain.report import ReportTarget, check_can_report, hidden_notice, preview, resolved_status
from tests.conftest import headers, login

# --- 도메인 규칙 (DB 없음) ---


def test_cannot_report_own_content():
    mine = ReportTarget("review", 1, owner_id=7, preview="별로예요")
    with pytest.raises(CannotReport):
        check_can_report(mine, 7)
    check_can_report(mine, 8)


def test_resolve_rules_and_notices():
    assert resolved_status("hide") == "resolved"
    assert resolved_status("dismiss") == "dismissed"
    assert len(preview("가" * 100)) == 60
    assert hidden_notice(ReportTarget("trade", 1, 7, "")) == ("거래글이 운영 정책으로 숨겨졌어요", "/local/trades/mine")
    assert hidden_notice(ReportTarget("review", 1, 7, "", product_id=3))[1] == "/products/3"
    assert hidden_notice(ReportTarget("avatar", 7, 7, ""))[0] == "아바타가 기본 모습으로 바뀌었어요"


# --- API (진짜 DB) ---


@pytest.fixture
async def tag():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM reports LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value
    async with SessionLocal() as session:  # 이 테스트가 만든 계정만 (문의 · 신고 · 알림은 함께 지워짐)
        await session.execute(delete(User).where(User.email.like(f"reports-{value}%@pixelmart.test")))
        await session.commit()


async def user(client, tag: str, name: str, *, admin: bool = False) -> tuple[str, int]:
    token = await login(client, f"reports-{tag}-{name}@pixelmart.test", f"{name}{tag}", admin=admin)
    client.cookies.clear()
    uid = (await client.get("/api/auth/me", headers=headers(token))).json()["id"]
    return token, uid


async def a_question(client, token: str) -> int:
    async with SessionLocal() as session:
        product_id = await session.scalar(select(Product.id).limit(1))
    res = await client.post(
        f"/api/products/{product_id}/questions",
        json={"title": "광고 링크", "content": "여기로 오세요"},
        headers=headers(token),
    )
    assert res.status_code == 201
    return res.json()["id"]


async def report(client, token: str, target_type: str, target_id: int, reason: str = "spam"):
    body = {"targetType": target_type, "targetId": target_id, "reason": reason, "memo": "확인 부탁해요"}
    return await client.post("/api/reports", json=body, headers=headers(token))


async def notices(client, token: str, kind: str) -> list[dict]:
    res = await client.get("/api/notifications", headers=headers(token))
    return [n for n in res.json()["items"] if n["kind"] == kind]


async def test_report_then_admin_hides_question(client, tag):
    writer, _ = await user(client, tag, "글쓴이")
    alice, _ = await user(client, tag, "신고A")
    bob, _ = await user(client, tag, "신고B")
    admin, _ = await user(client, tag, "관리", admin=True)
    qid = await a_question(client, writer)

    first = await report(client, alice, "question", qid)
    assert first.status_code == 201
    assert first.json()["status"] == "open"
    assert (await report(client, bob, "question", qid, "abuse")).status_code == 201

    again = await report(client, alice, "question", qid)
    assert again.status_code == 400
    assert again.json()["detail"] == "이미 신고한 내용이에요."

    inbox = await client.get("/api/admin/reports", params={"targetType": "question"}, headers=headers(admin))
    row = next(r for r in inbox.json()["items"] if r["targetId"] == qid)
    assert row["reportCount"] == 2  # 대상 하나에 한 줄
    assert row["reporterNickname"] == f"신고B{tag}"  # 가장 최근 신고
    assert row["targetPreview"].startswith("광고 링크")

    done = await client.post(f"/api/admin/reports/{row['id']}/resolve", json={"action": "hide"}, headers=headers(admin))
    assert done.status_code == 200
    assert done.json()["status"] == "resolved"
    async with SessionLocal() as session:
        assert (await session.get(ProductQuestion, qid)).is_hidden is True

    owner_notice = await notices(client, writer, "report_hidden")
    assert [n["title"] for n in owner_notice] == ["작성한 문의가 운영 정책으로 숨겨졌어요"]
    for reporter in (alice, bob):  # 같은 대상의 신고자 모두에게
        assert [n["title"] for n in await notices(client, reporter, "report_done")] == ["신고하신 내용을 처리했어요"]

    twice = await client.post(
        f"/api/admin/reports/{row['id']}/resolve", json={"action": "hide"}, headers=headers(admin)
    )
    assert twice.status_code == 409

    # 처리된 뒤에는 다시 신고할 수 있음 (열린 신고만 하나)
    assert (await report(client, alice, "question", qid)).status_code == 201


async def test_dismiss_keeps_avatar(client, tag):
    owner, owner_id = await user(client, tag, "그림")
    reporter, _ = await user(client, tag, "신고C")
    admin, _ = await user(client, tag, "관리2", admin=True)
    async with SessionLocal() as session:
        await session.execute(update(User).where(User.id == owner_id).values(avatar_url="data:image/png;base64,AAAA"))
        await session.commit()

    rid = (await report(client, reporter, "avatar", owner_id, "inappropriate")).json()["id"]
    res = await client.post(f"/api/admin/reports/{rid}/resolve", json={"action": "dismiss"}, headers=headers(admin))
    assert res.json()["status"] == "dismissed"
    assert (await client.get("/api/auth/me", headers=headers(owner))).json()["avatarUrl"] is not None
    assert await notices(client, owner, "report_hidden") == []

    rid = (await report(client, reporter, "avatar", owner_id)).json()["id"]
    await client.post(f"/api/admin/reports/{rid}/resolve", json={"action": "hide"}, headers=headers(admin))
    assert (await client.get("/api/auth/me", headers=headers(owner))).json()["avatarUrl"] is None


async def test_report_failures(client, tag):
    writer, writer_id = await user(client, tag, "글쓴이2")
    reporter, reporter_id = await user(client, tag, "신고D")
    admin, admin_id = await user(client, tag, "관리3", admin=True)
    qid = await a_question(client, writer)

    own = await report(client, writer, "question", qid)
    assert own.status_code == 400
    assert own.json()["detail"] == "내가 올린 내용은 신고할 수 없어요."
    missing = await report(client, reporter, "review", 999999999)
    assert missing.status_code == 404
    assert (await report(client, reporter, "avatar", writer_id)).status_code == 404  # 아바타가 없으면 대상 없음
    assert (await report(client, reporter, "spaceship", qid)).status_code == 422
    assert (
        await client.post("/api/reports", json={"targetType": "question", "targetId": qid, "reason": "spam"})
    ).status_code == 401

    await client.patch(f"/api/admin/users/{reporter_id}", json={"suspended": True}, headers=headers(admin))
    blocked = await report(client, reporter, "question", qid)
    assert blocked.status_code == 403  # 정지된 계정은 신고도 막힘

    assert (await client.get("/api/admin/reports", headers=headers(writer))).status_code == 404
    resolve = await client.post("/api/admin/reports/999999999/resolve", json={"action": "hide"}, headers=headers(admin))
    assert resolve.status_code == 404
