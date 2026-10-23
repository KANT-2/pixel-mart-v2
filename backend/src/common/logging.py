import logging
from collections.abc import Awaitable, Callable
from time import perf_counter

from fastapi import Request, Response

logger = logging.getLogger("uvicorn.error")


async def log_requests(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    started_at = perf_counter()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response

    finally:
        elapsed_ms = round((perf_counter() - started_at) * 1000)

        # FastAPI 0.137+의 전체 라우트 경로 확인
        fastapi_scope = request.scope.get("fastapi", {})
        context = (
            fastapi_scope.get("effective_route_context")
            if isinstance(fastapi_scope, dict)
            else None
        )

        # 전체 경로 우선, 기존 방식은 호환용으로 사용
        route = request.scope.get("route")
        path = (
            getattr(context, "path", None)
            or getattr(route, "path", None)
            or "<unmatched>"
        )

        logger.info(
            "%s %s %s %dms",
            request.method,
            path,
            status_code,
            elapsed_ms,
        )