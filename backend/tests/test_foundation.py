import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.common.errors import (
    DomainError,
    ForbiddenError,
    InvalidInputError,
    InvalidStateError,
    NotFoundError,
    domain_error_handler,
)


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (NotFoundError, 404),
        (ForbiddenError, 403),
        (InvalidStateError, 400),
        (InvalidInputError, 422),
    ],
)
async def test_domain_error_http_response(error, expected_status):
    app = FastAPI()
    app.add_exception_handler(DomainError, domain_error_handler)

    @app.get("/test-error")
    async def test_route():
        raise error("테스트 오류")

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/test-error")

    assert response.status_code == expected_status
    assert response.json() == {"detail": "테스트 오류"}
