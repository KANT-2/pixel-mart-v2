# 사용자에게 보이는 오류 문구 — 영어 기본 문구 · 보낸 값 · 사실과 다른 안내를 내보내지 않는다
from app.core.config import settings


async def test_validation_error_is_korean_and_does_not_echo_input(client):
    res = await client.post("/api/auth/signup", json={"email": "x@pixelmart.test", "password": "1"})
    assert res.status_code == 422
    body = res.json()
    assert body["detail"].startswith("비밀번호:")  # 첫 오류를 한글로
    assert {"field": "nickname", "message": "꼭 입력해 주세요."} in body["errors"]
    assert "1" not in str(body["errors"]) and "input" not in res.text  # 보낸 비밀번호를 되돌려 주지 않는다


async def test_query_validation_error_is_korean(client):
    res = await client.get("/api/products", params={"page": 0})
    assert res.status_code == 422
    assert res.json()["detail"] == "페이지: 1 이상이어야 해요."


async def test_password_reset_does_not_claim_mail_was_sent_when_deployed(client, monkeypatch):
    monkeypatch.setattr(settings, "env", "production")
    res = (await client.post("/api/auth/password-reset", json={"email": "nobody@pixelmart.test"})).json()
    assert res["resetUrl"] is None
    assert "보냈" not in res["message"] and "보내지 않아요" in res["message"]
