"""Liveness and dependency readiness endpoints."""

import asyncio
from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response, status
from redis.exceptions import RedisError

from gateway.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", operation_id="getLiveness")
def liveness() -> HealthResponse:
    """Report that the worker event loop is serving requests."""

    return HealthResponse(status="alive", timestamp=datetime.now(UTC))


@router.get("/ready", operation_id="getReadiness")
async def readiness(request: Request, response: Response) -> ReadinessResponse:
    """Report whether the initialized Gateway can reach DB and Redis concurrently."""

    is_ready = getattr(request.app.state, "ready", False)
    if is_ready:
        database_ok, redis_ok = await asyncio.gather(
            _database_available(request),
            _redis_available(request),
        )
    else:
        database_ok = redis_ok = False
    if not database_ok or not redis_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(
        status="ready" if database_ok and redis_ok else "not_ready",
        timestamp=datetime.now(UTC),
        checks={
            "database": {"status": "ok" if database_ok else "error"},
            "redis": {"status": "ok" if redis_ok else "error"},
        },
    )


async def _database_available(request: Request) -> bool:
    try:
        async with asyncio.timeout(request.app.state.settings.database_timeout_seconds):
            return await request.app.state.database.is_available()
    except TimeoutError:
        return False


async def _redis_available(request: Request) -> bool:
    try:
        async with asyncio.timeout(request.app.state.settings.redis_timeout_seconds):
            return bool(await request.app.state.redis.ping())
    except RedisError, TimeoutError:
        return False
