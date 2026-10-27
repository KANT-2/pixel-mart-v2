import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select, text

from app.core.db import SessionLocal, engine
from app.models import BadgeDefinition, User, UserBadge
from app.services import badges as auto
from src.badges.domain.badge import (
    BadgeInfo,
    BadgeRuleError,
    NotEarned,
    check_can_feature,
    check_event_badge,
    is_new,
    next_event_code,
    progress_of,
    resolve_featured,
)
from tests.conftest import headers, login

# --- 도메인 규칙 (DB 없음) ---


def info(code: str, rank: int = 1, kind: str = "auto", active: bool = True) -> BadgeInfo:
    return BadgeInfo(code, code, "", f"/images/badges/{code}.png", "", rank, kind, active)


def test_badge_rules():
    assert next_event_code([]) == "event_1"
    assert next_event_code(["event_1", "event_7", "event_x", "santa"]) == "event_8"
    assert progress_of("reviewer", {"reviews": 5}).current == 3  # 목표를 넘으면 목표로
    assert progress_of("new_player", {}) is None
    now = datetime.now(UTC)
    assert is_new(now - timedelta(days=6), now) and not is_new(now - timedelta(days=8), now)
    assert not is_new(None, now)

    owned = [info("new_player", 1), info("reviewer", 5)]
    assert resolve_featured(None, owned) == "reviewer"  # 안 골랐으면 가장 어려운 것
    assert resolve_featured("new_player", owned) == "new_player"
    assert resolve_featured("santa", owned) == "reviewer"  # 이제 없는 뱃지면 자동
    assert resolve_featured(None, []) is None
    with pytest.raises(NotEarned):
        check_can_feature("santa", {"new_player"})


def test_only_active_event_badges_are_managed():
    check_event_badge(info("event_1", kind="event"), "grant")
    with pytest.raises(BadgeRuleError, match="자동 뱃지"):
        check_event_badge(info("santa"), "update")
    with pytest.raises(BadgeRuleError, match="꺼 둔"):
        check_event_badge(info("event_2", kind="event", active=False), "grant")
    check_event_badge(info("event_2", kind="event", active=False), "revoke")  # 꺼 둬도 회수는 된다


# --- API (진짜 DB) ---


@pytest.fixture
async def tag():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT featured_badge FROM users LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value
    async with SessionLocal() as session:  # 이 테스트가 만든 이벤트 뱃지 · 계정만
        users = select(User.id).where(User.email.like(f"badges-{value}%@pixelmart.test"))
        codes = select(BadgeDefinition.code).where(BadgeDefinition.created_by.in_(users))
        await session.execute(delete(UserBadge).where(UserBadge.code.in_(codes)))
        await session.execute(delete(BadgeDefinition).where(BadgeDefinition.created_by.in_(users)))
        await session.execute(delete(User).where(User.email.like(f"badges-{value}%@pixelmart.test")))
        await session.commit()


async def player(client, tag: str, name: str, *, admin: bool = False) -> tuple[str, int]:
    token = await login(client, f"badges-{tag}-{name}@pixelmart.test", f"{name}{tag}", admin=admin)
    client.cookies.clear()
    return token, (await client.get("/api/auth/me", headers=headers(token))).json()["id"]


async def badge_notices(client, token: str) -> list[str]:
    res = await client.get("/api/notifications", headers=headers(token))
    return [n["title"] for n in res.json()["items"] if n["kind"] == "badge"]


async def test_earned_badges_stay_after_condition_is_gone(client, tag):
    token, uid = await player(client, tag, "기록")
    async with SessionLocal() as session:
        user = await session.get(User, uid)
        assert await auto.sync(session, user, auto.Stats()) == []  # 처음 저장은 조용히 (알림 없음)
        new = await auto.sync(session, user, auto.Stats(orders=1))
        assert [b.code for b in new] == ["first_order"]
        assert await auto.sync(session, user, auto.Stats()) == []  # 주문을 취소해도
        await session.commit()

    book = (await client.get("/api/users/me/badges", headers=headers(token))).json()
    first_order = next(i for i in book["items"] if i["code"] == "first_order")
    assert first_order["earned"] is True and first_order["isNew"] is True and first_order["earnedAt"]
    assert first_order["progress"] == {"current": 0, "goal": 1}  # 진행 막대는 지금 기록


async def test_featured_badge_choice(client, tag):
    token, _ = await player(client, tag, "대표")
    res = await client.patch("/api/users/me/featured-badge", json={"code": "santa"}, headers=headers(token))
    assert res.status_code == 400 and res.json()["detail"] == "아직 받지 않은 뱃지예요."
    res = await client.patch("/api/users/me/featured-badge", json={"code": "new_player"}, headers=headers(token))
    assert res.status_code == 200 and res.json()["featured"] == "new_player"
    res = await client.patch("/api/users/me/featured-badge", json={"code": None}, headers=headers(token))
    assert res.json()["featured"] == "new_player"  # 자동이어도 가진 것 중 가장 어려운 것


async def test_admin_event_badge_lifecycle(client, tag):
    admin, _ = await player(client, tag, "boss", admin=True)
    fan, fan_id = await player(client, tag, "팬")

    images = (await client.get("/api/admin/badge-images", headers=headers(admin))).json()
    assert "/images/badges/santa.png" in images
    body = {"name": f"축제{tag}", "description": "가을 축제 참가", "image": "/images/badges/santa.png"}
    created = await client.post("/api/admin/badges", json=body, headers=headers(admin))
    assert created.status_code == 201
    code = created.json()["code"]
    assert code.startswith("event_") and created.json()["kind"] == "event" and created.json()["holderCount"] == 0

    bad_image = await client.post(
        "/api/admin/badges", json=body | {"image": "https://x.test/a.png"}, headers=headers(admin)
    )
    assert bad_image.status_code == 400
    auto_patch = await client.patch("/api/admin/badges/santa", json={"name": "산타"}, headers=headers(admin))
    assert auto_patch.status_code == 400 and auto_patch.json()["detail"] == "자동 뱃지는 코드로 관리돼요."

    for _ in range(2):  # 두 번 줘도 알림 · 기록은 한 번
        grant = await client.post(
            f"/api/admin/badges/{code}/grant",
            json={"userIds": [fan_id, 999999999], "memo": "현장 참가"},
            headers=headers(admin),
        )
    assert grant.json() == {"granted": 0, "skipped": 2}
    assert await badge_notices(client, fan) == [f"🎪 이벤트 뱃지를 받았어요: 축제{tag}"]

    book = (await client.get("/api/users/me/badges", headers=headers(fan))).json()
    assert book["total"] == 20  # 자동 19 + 받은 이벤트 1
    item = next(i for i in book["items"] if i["code"] == code)
    assert item["kind"] == "event" and item["grantedMemo"] == "현장 참가"
    featured = await client.patch("/api/users/me/featured-badge", json={"code": code}, headers=headers(fan))
    assert featured.json()["featured"] == code

    holders = (await client.get(f"/api/admin/badges/{code}/holders", headers=headers(admin))).json()
    assert [h["userId"] for h in holders["items"]] == [fan_id] and holders["items"][0][
        "grantedByNickname"
    ] == f"boss{tag}"

    revoked = await client.delete(f"/api/admin/badges/{code}/holders/{fan_id}", headers=headers(admin))
    assert revoked.status_code == 200
    again = await client.delete(f"/api/admin/badges/{code}/holders/{fan_id}", headers=headers(admin))
    assert again.status_code == 404
    book = (await client.get("/api/users/me/badges", headers=headers(fan))).json()
    assert book["total"] == 19 and book["featured"] == "new_player"  # 대표도 자동으로 돌아감

    off = await client.patch(f"/api/admin/badges/{code}", json={"isActive": False}, headers=headers(admin))
    assert off.status_code == 200 and off.json()["isActive"] is False
    grant = await client.post(f"/api/admin/badges/{code}/grant", json={"userIds": [fan_id]}, headers=headers(admin))
    assert grant.status_code == 400 and grant.json()["detail"] == "꺼 둔 뱃지는 줄 수 없어요."

    listed = (await client.get("/api/admin/badges", headers=headers(admin))).json()
    assert len(listed["auto"]) == 19 and code in [b["code"] for b in listed["event"]]
    assert (await client.get("/api/admin/badges/event_999999/holders", headers=headers(admin))).status_code == 404


async def test_badge_admin_is_hidden_from_players(client, tag):
    token, _ = await player(client, tag, "일반")
    assert (await client.get("/api/admin/badges", headers=headers(token))).status_code == 404
    assert (await client.get("/api/admin/badges")).status_code == 401
