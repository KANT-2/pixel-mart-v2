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

        route = request.scope.get("route")
        path = route.path if route is not None else "<unmatched>"

        logger.info(
            "%s %s %s %dms",
            request.method,
            path,
            status_code,
            elapsed_ms,
        )