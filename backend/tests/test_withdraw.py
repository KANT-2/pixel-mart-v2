import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete, select, text

from app.core.db import SessionLocal, engine
from app.models import CartItem, Order, Product, User
from src.auth.application.withdrawal import WithdrawService
from src.auth.domain.exceptions import CannotWithdraw
from src.auth.domain.token import IssuedToken
from src.auth.domain.withdrawal import (
    WITHDRAWN_NAME,
    WithdrawTarget,
    check_can_withdraw,
    display_nickname,
    withdrawn_email,
    withdrawn_nickname,
)
from tests.conftest import headers, login

CONFIRM = {"confirm": "탈퇴"}


# --- 도메인 규칙 (DB 없음) ---


def target(**kw) -> WithdrawTarget:
    return WithdrawTarget(**{"id": 7, "role": "user", "deleted_at": None, "active_orders": 0, **kw})


def test_normal_user_can_withdraw():
    check_can_withdraw(target())


@pytest.mark.parametrize(
    ("kw", "message"),
    [
        ({"active_orders": 1}, "진행 중인 주문이 있어 탈퇴할 수 없어요. 배송 완료 후 다시 시도해 주세요."),
        ({"role": "admin"}, "관리자 계정은 탈퇴할 수 없어요."),
        ({"deleted_at": datetime(2026, 10, 27, tzinfo=UTC)}, "이미 탈퇴한 계정이에요."),
    ],
)
def test_withdraw_is_blocked(kw, message):
    with pytest.raises(CannotWithdraw, match=message):
        check_can_withdraw(target(**kw))


def test_withdrawn_names_never_collide_and_hide_author():
    assert withdrawn_email(7) == "deleted-7@deleted.pixelmart"
    assert withdrawn_nickname(7) != withdrawn_nickname(8)
    assert display_nickname("픽셀곰", None) == "픽셀곰"
    assert display_nickname("탈퇴#7", datetime(2026, 10, 27, tzinfo=UTC)) == WITHDRAWN_NAME


# --- 서비스 (가짜 저장소) ---


class FakeStore:
    def __init__(self, t: WithdrawTarget | None, fail: bool = False) -> None:
        self.t, self.fail, self.calls = t, fail, []

    async def target(self, user_id):
        return self.t

    async def clean_up(self, user_id):
        self.calls.append("clean_up")
        if self.fail:
            raise RuntimeError("저장 실패")

    async def anonymize(self, user_id, now):
        self.calls.append("anonymize")


class FakeBlacklist:
    def __init__(self) -> None:
        self.jtis = []

    async def add(self, jti, expires_at):
        self.jtis.append(jti)


class FakeTx:
    def __init__(self) -> None:
        self.commits = self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


NOW = datetime(2026, 10, 27, tzinfo=UTC)
TOKEN = IssuedToken(user_id=7, jti="abc", expires_at=NOW)


async def test_service_cleans_anonymizes_blacklists_and_commits_once():
    store, bl, tx = FakeStore(target()), FakeBlacklist(), FakeTx()
    await WithdrawService(store, bl, tx).withdraw(7, TOKEN, NOW)
    assert store.calls == ["clean_up", "anonymize"]
    assert bl.jtis == ["abc"]
    assert (tx.commits, tx.rollbacks) == (1, 0)


async def test_service_rolls_back_when_saving_fails():
    store, bl, tx = FakeStore(target(), fail=True), FakeBlacklist(), FakeTx()
    with pytest.raises(RuntimeError):
        await WithdrawService(store, bl, tx).withdraw(7, TOKEN, NOW)
    assert (tx.commits, tx.rollbacks) == (0, 1)
    assert bl.jtis == []


async def test_service_checks_rules_before_touching_data():
    store, tx = FakeStore(target(active_orders=2)), FakeTx()
    with pytest.raises(CannotWithdraw):
        await WithdrawService(store, FakeBlacklist(), tx).withdraw(7, TOKEN, NOW)
    assert store.calls == [] and tx.commits == 0


# --- API (진짜 DB) ---


@pytest.fixture
async def tag():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT deleted_at FROM users LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    ids: list[int] = []
    yield value, ids
    async with SessionLocal() as session:  # 이 테스트가 만든 계정만 지운다 (탈퇴하면 이메일이 바뀌어서 id로도)
        await session.execute(delete(User).where(User.email.like(f"withdraw-{value}%@pixelmart.test")))
        if ids:
            await session.execute(delete(User).where(User.id.in_(ids)))
        await session.commit()


async def me_id(client, token) -> int:
    return (await client.get("/api/auth/me", headers=headers(token))).json()["id"]


async def test_withdraw_anonymizes_and_same_token_is_401(client, tag):
    value, ids = tag
    email = f"withdraw-{value}-a@pixelmart.test"
    token = await login(client, email, f"떠남{value}")
    client.cookies.clear()
    uid = await me_id(client, token)
    ids.append(uid)
    async with SessionLocal() as session:  # 장바구니에 하나 담아 두기
        product_id = await session.scalar(select(Product.id).limit(1))
        session.add(CartItem(user_id=uid, product_id=product_id, quantity=1))
        await session.commit()

    res = await client.post("/api/users/me/withdraw", json=CONFIRM, headers=headers(token))
    assert res.status_code == 200
    assert res.json()["message"].startswith("탈퇴했어요")
    assert (await client.get("/api/auth/me", headers=headers(token))).status_code == 401

    async with SessionLocal() as session:
        user = await session.get(User, uid)
        assert user.email == f"deleted-{uid}@deleted.pixelmart"
        assert user.nickname == f"탈퇴#{uid}"
        assert user.deleted_at is not None and user.password_hash is None
        assert await session.scalar(select(CartItem).where(CartItem.user_id == uid)) is None

    # 같은 이메일로 다시 들어오면 새 계정 (옛 기록 복구 X)
    again = await login(client, email, f"새로{value}")
    client.cookies.clear()
    assert await me_id(client, again) != uid


async def test_wrong_confirm_is_422_and_nothing_changes(client, tag):
    value, _ = tag
    token = await login(client, f"withdraw-{value}-b@pixelmart.test", f"망설임{value}")
    client.cookies.clear()
    res = await client.post("/api/users/me/withdraw", json={"confirm": "네"}, headers=headers(token))
    assert res.status_code == 422
    assert (await client.get("/api/auth/me", headers=headers(token))).status_code == 200


async def test_active_order_and_admin_are_400(client, tag):
    value, _ = tag
    token = await login(client, f"withdraw-{value}-c@pixelmart.test", f"주문중{value}")
    client.cookies.clear()
    uid = await me_id(client, token)
    async with SessionLocal() as session:
        session.add(Order(user_id=uid, status="shipping", total_price=1000, recipient_name="테스트", address="테스트"))
        await session.commit()
    res = await client.post("/api/users/me/withdraw", json=CONFIRM, headers=headers(token))
    assert res.status_code == 400
    assert res.json()["detail"] == "진행 중인 주문이 있어 탈퇴할 수 없어요. 배송 완료 후 다시 시도해 주세요."
    assert (await client.get("/api/auth/me", headers=headers(token))).status_code == 200

    admin = await login(client, f"withdraw-{value}-d@pixelmart.test", f"관리{value}", admin=True)
    client.cookies.clear()
    res = await client.post("/api/users/me/withdraw", json=CONFIRM, headers=headers(admin))
    assert res.status_code == 400
    assert res.json()["detail"] == "관리자 계정은 탈퇴할 수 없어요."


async def test_logged_out_user_cannot_withdraw(client):
    res = await client.post("/api/users/me/withdraw", json=CONFIRM)
    assert res.status_code == 401
