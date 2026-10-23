from unittest.mock import patch

from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from src.main import app


async def test_cors_preflight_logging():
    # 실제 서버나 DB 연결 없이 FastAPI 앱에 요청
    transport = ASGITransport(app=app)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        with patch("src.common.logging.logger") as mock_logger:
            response = await client.options(
                "/api/orders?token=sample-secret",
                headers={
                    "Origin": settings.frontend_url,
                    "Access-Control-Request-Method": "POST",
                    "Authorization": "Bearer sample-secret",
                },
            )

    # CORS 요청 정상 처리
    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == settings.frontend_url
    )

    # 요청당 로그 한 번 기록
    mock_logger.info.assert_called_once()

    log_format, method, path, status, elapsed_ms = (
        mock_logger.info.call_args.args
    )

    assert log_format == "%s %s %s %dms"
    assert method == "OPTIONS"
    assert path == "<unmatched>"
    assert status == 200
    assert isinstance(elapsed_ms, int)
    assert elapsed_ms >= 0

    # 요청에 포함된 토큰이 로그에 없는지 검증
    assert "sample-secret" not in repr(mock_logger.info.call_args)


async def test_dev_login_logging_full_path():
    # 로그인 API 전체 경로와 민감정보 제외 여부 검증
    transport = ASGITransport(app=app)

    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        with patch("src.common.logging.logger") as mock_logger:
            response = await client.post(
                "/api/auth/dev-login?token=query-marker-123",
                headers={
                    "Authorization": "Bearer header-marker-123",
                },
                json={},
            )

    # 이메일 필수값 누락으로 422 반환
    assert response.status_code == 422

    # 요청당 로그 한 번 기록
    mock_logger.info.assert_called_once()

    log_format, method, path, status, elapsed_ms = (
        mock_logger.info.call_args.args
    )

    # 전체 API 경로 및 로그 형식 확인
    assert log_format == "%s %s %s %dms"
    assert method == "POST"
    assert path == "/api/auth/dev-login"
    assert status == 422
    assert isinstance(elapsed_ms, int)
    assert elapsed_ms >= 0

    # 민감정보가 로그에 포함되지 않았는지 확인
    log_content = repr(mock_logger.info.call_args)

    assert "query-marker-123" not in log_content
    assert "header-marker-123" not in log_content
