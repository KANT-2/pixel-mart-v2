from datetime import UTC, datetime, timedelta

import jwt
import pytest

from src.auth.domain.account import Account, check_password, normalize_email
from src.auth.domain.exceptions import InvalidEmail, InvalidNickname, InvalidToken, WeakPassword
from src.auth.domain.token import IssuedToken, can_forget_blacklisted
from src.auth.infrastructure.hasher import hash_password, verify_password
from src.auth.infrastructure.jwt import decode_token, issue_token
from src.common.errors import domain_error_handler

# --- 도메인: Account ---


def test_email_is_trimmed_and_lowercased():
    assert normalize_email("  Hero@PixelMart.TEST ") == "hero@pixelmart.test"


@pytest.mark.parametrize("email", ["", "hero", "hero@", "@pixelmart.test", "hero@pixelmart", "he ro@pixelmart.test"])
def test_bad_email_is_rejected(email):
    with pytest.raises(InvalidEmail):
        normalize_email(email)


def test_short_password_is_rejected():
    with pytest.raises(WeakPassword, match="8자 이상"):
        check_password("1234567")


def test_password_over_72_bytes_is_rejected():
    check_password("a" * 72)
    with pytest.raises(WeakPassword, match="너무 길어요"):
        check_password("a" * 73)
    with pytest.raises(WeakPassword):
        check_password("가" * 25)  # 한글 1자 = 3바이트 → 75바이트


def test_account_normalizes_and_knows_admin():
    account = Account(id=1, email="Admin@PixelMart.test", nickname=" 관리자 ", password_hash="x", role="admin")
    assert account.email == "admin@pixelmart.test"
    assert account.nickname == "관리자"
    assert account.is_admin
    assert account.can_password_login


def test_google_account_has_no_password_login():
    account = Account(id=2, email="g@pixelmart.test", nickname="구글", password_hash=None)
    assert not account.is_admin
    assert not account.can_password_login


@pytest.mark.parametrize("nickname", ["", "   ", "가" * 31])
def test_bad_nickname_is_rejected(nickname):
    with pytest.raises(InvalidNickname):
        Account(id=None, email="n@pixelmart.test", nickname=nickname)


def test_issued_token_expiry():
    now = datetime(2026, 10, 24, tzinfo=UTC)
    token = IssuedToken(user_id=1, jti="abc", expires_at=now + timedelta(minutes=1))
    assert not token.is_expired(now)
    assert token.is_expired(now + timedelta(minutes=1))


# --- 인프라: 비밀번호 해싱 ---


def test_hash_and_verify_password():
    hashed = hash_password("pixel-pass-1")
    assert hashed != "pixel-pass-1"  # 평문을 그대로 저장하지 않음
    assert verify_password("pixel-pass-1", hashed)
    assert not verify_password("pixel-pass-2", hashed)


def test_same_password_gives_different_hash():
    assert hash_password("pixel-pass-1") != hash_password("pixel-pass-1")


def test_broken_hash_returns_false():
    assert not verify_password("pixel-pass-1", "not-a-bcrypt-hash")


# --- 인프라: JWT ---

SECRET = "test-secret-at-least-32-characters-long"


def test_token_round_trip_keeps_sub_and_jti():
    raw, issued = issue_token(7, secret=SECRET)
    decoded = decode_token(raw, secret=SECRET)
    assert decoded.user_id == 7
    assert decoded.jti == issued.jti
    assert decoded.expires_at == issued.expires_at.replace(microsecond=0)


def test_every_token_has_its_own_jti():
    _, first = issue_token(7, secret=SECRET)
    _, second = issue_token(7, secret=SECRET)
    assert first.jti != second.jti


def test_expired_token_is_rejected():
    raw, _ = issue_token(7, secret=SECRET, now=datetime.now(UTC) - timedelta(minutes=10), expire_minutes=5)
    with pytest.raises(InvalidToken, match="다시 로그인"):
        decode_token(raw, secret=SECRET)


def test_token_with_wrong_secret_is_rejected():
    raw, _ = issue_token(7, secret=SECRET)
    with pytest.raises(InvalidToken):
        decode_token(raw, secret="another-secret-at-least-32-characters")


def test_tampered_or_garbage_token_is_rejected():
    raw, _ = issue_token(7, secret=SECRET)
    with pytest.raises(InvalidToken):
        decode_token(raw[:-2] + "xx", secret=SECRET)
    with pytest.raises(InvalidToken):
        decode_token("not-a-token", secret=SECRET)


def test_token_without_jti_is_rejected():
    legacy = jwt.encode({"sub": "7", "exp": datetime.now(UTC) + timedelta(minutes=5)}, SECRET, algorithm="HS256")
    with pytest.raises(InvalidToken):
        decode_token(legacy, secret=SECRET)


# --- 예외 → HTTP 상태 연결 ---


@pytest.mark.parametrize(
    ("error", "status_code"),
    [(InvalidEmail(), 422), (WeakPassword("x"), 422), (InvalidNickname("x"), 422), (InvalidToken(), 401)],
)
async def test_auth_errors_map_to_http_status(error, status_code):
    response = await domain_error_handler(None, error)
    assert response.status_code == status_code


def test_blacklist_row_is_forgettable_only_after_expiry():
    now = datetime(2026, 10, 24, tzinfo=UTC)
    assert can_forget_blacklisted(now - timedelta(seconds=1), now)
    assert not can_forget_blacklisted(now, now)  # 만료 시각과 같은 순간엔 JWT가 아직 유효
    assert not can_forget_blacklisted(now + timedelta(days=7), now)
