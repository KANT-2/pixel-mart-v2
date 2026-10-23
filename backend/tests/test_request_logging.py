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
        # 로그 출력 내용을 검사하기 위해 logger를 Mock으로 교체
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

    # 로그에 기록된 정보 검증
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