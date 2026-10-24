import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.user import User
from src.auth.application.service import AuthService
from src.auth.domain.account import Account
from src.auth.domain.exceptions import EmailTaken, LoginFailed, NicknameTaken, WeakPassword
from src.auth.domain.token import IssuedToken
from src.auth.infrastructure.hasher import hash_password
from src.auth.infrastructure.jwt import decode_token
from src.auth.infrastructure.models import TokenBlacklist
from src.auth.infrastructure.repositories import TokenBlacklistRepository, UserRepository

PASSWORD = "pixel-pass-1"


# --- DB 없이: 가짜 저장소로 서비스 규칙만 ---


class FakeUsers:
    def __init__(self) -> None:
        self.rows: list[Account] = []

    async def get_by_email(self, email):
        return next((a for a in self.rows if a.email == email), None)

    async def email_exists(self, email):
        return any(a.email == email for a in self.rows)

    async def nickname_exists(self, nickname):
        return any(a.nickname.lower() == nickname.lower() for a in self.rows)

    async def add(self, account):
        saved = Account(
            id=len(self.rows) + 1, email=account.email, nickname=account.nickname, password_hash=account.password_hash
        )
        self.rows.append(saved)
        return saved


class FakeBlacklist:
    def __init__(self) -> None:
        self.jtis: dict[str, datetime] = {}

    async def add(self, jti, expires_at):
        self.jtis.setdefault(jti, expires_at)

    async def contains(self, jti):
        return jti in self.jtis


class FakeTx:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


@pytest.fixture
def fake():
    users, blacklist, tx = FakeUsers(), FakeBlacklist(), FakeTx()
    return AuthService(users, blacklist, tx), users, tx


async def test_signup_saves_only_hash(fake):
    service, users, tx = fake
    account = await service.signup("Hero@PixelMart.test", PASSWORD, "용사")
    assert account.id == 1
    assert account.email == "hero@pixelmart.test"
    assert users.rows[0].password_hash != PASSWORD
    assert users.rows[0].password_hash.startswith("$2b$")
    assert tx.commits == 1


async def test_duplicate_email_is_409(fake):
    service, users, _ = fake
    await service.signup("hero@pixelmart.test", PASSWORD, "용사")
    with pytest.raises(EmailTaken):
        await service.signup("HERO@pixelmart.test", PASSWORD, "다른용사")
    assert len(users.rows) == 1


async def test_duplicate_nickname_is_409_case_insensitive(fake):
    service, *_ = fake
    await service.signup("a@pixelmart.test", PASSWORD, "Slime")
    with pytest.raises(NicknameTaken):
        await service.signup("b@pixelmart.test", PASSWORD, "slime")


async def test_weak_password_stops_before_saving(fake):
    service, users, tx = fake
    with pytest.raises(WeakPassword):
        await service.signup("a@pixelmart.test", "short", "용사")
    assert users.rows == []
    assert tx.commits == 0


async def test_failed_save_rolls_back(fake):
    service, users, tx = fake

    async def broken_add(_account):
        raise RuntimeError("DB 끊김")

    users.add = broken_add
    with pytest.raises(RuntimeError):
        await service.signup("a@pixelmart.test", PASSWORD, "용사")
    assert tx.commits == 0
    assert tx.rollbacks == 1


async def test_login_returns_token_for_that_user(fake):
    service, *_ = fake
    account = await service.signup("hero@pixelmart.test", PASSWORD, "용사")
    raw, issued = await service.login(" HERO@pixelmart.test ", PASSWORD)
    assert decode_token(raw).user_id == account.id == issued.user_id


@pytest.mark.parametrize(
    ("email", "password"),
    [("hero@pixelmart.test", "wrong-pass-1"), ("nobody@pixelmart.test", PASSWORD), ("not-an-email", PASSWORD)],
)
async def test_login_failure_is_one_message(fake, email, password):
    service, *_ = fake
    await service.signup("hero@pixelmart.test", PASSWORD, "용사")
    with pytest.raises(LoginFailed, match="이메일 또는 비밀번호가 맞지 않아요."):
        await service.login(email, password)


async def test_google_user_cannot_password_login(fake):
    service, users, _ = fake
    users.rows.append(Account(id=9, email="g@pixelmart.test", nickname="구글", password_hash=None))
    with pytest.raises(LoginFailed):
        await service.login("g@pixelmart.test", PASSWORD)


async def test_logout_revokes_only_that_token_and_twice_is_fine(fake):
    service, *_ = fake
    await service.signup("hero@pixelmart.test", PASSWORD, "용사")
    _, first = await service.login("hero@pixelmart.test", PASSWORD)
    _, second = await service.login("hero@pixelmart.test", PASSWORD)
    await service.logout(first)
    await service.logout(first)
    assert await service.is_revoked(first.jti)
    assert not await service.is_revoked(second.jti)


# --- 실제 DB: Repository가 users · token_blacklist와 맞게 동작하는지 ---


@pytest.fixture
async def db():
    # 테스트마다 새 연결 (다른 테스트의 이벤트 루프와 섞이지 않게)
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM token_blacklist LIMIT 1"))
    except Exception:
        await engine.dispose()
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    tag = uuid.uuid4().hex[:8]
    yield sessions, tag
    async with sessions() as session:  # 이 테스트가 만든 줄만 지운다
        await session.execute(delete(User).where(User.email.like(f"auth-{tag}%@pixelmart.test")))
        await session.execute(delete(TokenBlacklist).where(TokenBlacklist.jti.like(f"{tag}%")))
        await session.commit()
    await engine.dispose()


def service_for(session):
    return AuthService(UserRepository(session), TokenBlacklistRepository(session), session)


async def test_db_signup_stores_hash_not_password(db):
    sessions, tag = db
    async with sessions() as session:
        account = await service_for(session).signup(f"auth-{tag}@pixelmart.test", PASSWORD, f"탐험가{tag}")
    async with sessions() as session:
        stored = await session.scalar(select(User.password_hash).where(User.id == account.id))
    assert stored != PASSWORD
    assert stored.startswith("$2b$")


async def test_db_duplicate_email_and_login(db):
    sessions, tag = db
    email = f"auth-{tag}@pixelmart.test"
    async with sessions() as session:
        await service_for(session).signup(email, PASSWORD, f"탐험가{tag}")
    async with sessions() as session:
        service = service_for(session)
        with pytest.raises(EmailTaken):
            await service.signup(email.upper(), PASSWORD, f"다른{tag}")
        with pytest.raises(LoginFailed):
            await service.login(email, "wrong-pass-1")
        raw, _ = await service.login(email, PASSWORD)
    assert decode_token(raw).user_id > 0


async def test_db_logout_twice_keeps_one_row(db):
    sessions, tag = db
    token = IssuedToken(user_id=1, jti=f"{tag}-jti", expires_at=datetime.now(UTC) + timedelta(days=1))
    async with sessions() as session:
        service = service_for(session)
        await service.logout(token)
        await service.logout(token)
        assert await service.is_revoked(token.jti)
        rows = await session.scalars(select(TokenBlacklist).where(TokenBlacklist.jti == token.jti))
        assert len(rows.all()) == 1


async def test_db_repository_maps_role(db):
    sessions, tag = db
    async with sessions() as session:
        session.add(
            User(
                email=f"auth-{tag}-admin@pixelmart.test",
                nickname=f"관리{tag}",
                role="admin",
                password_hash=hash_password(PASSWORD),
            )
        )
        await session.commit()
        account = await UserRepository(session).get_by_email(f"AUTH-{tag}-admin@pixelmart.test")
    assert account is not None
    assert account.is_admin
