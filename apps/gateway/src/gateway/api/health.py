import asyncio
from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response, status
from redis.exceptions import RedisError

from gateway.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", operation_id="getLiveness")
def liveness() -> HealthResponse:
    return HealthResponse(status="alive", timestamp=datetime.now(UTC))


@router.get("/ready", operation_id="getReadiness")
async def readiness(request: Request, response: Response) -> ReadinessResponse:
    is_ready = getattr(request.app.state, "ready", False)
    database_ok = is_ready and await request.app.state.database.is_available()
    try:
        async with asyncio.timeout(2):
            redis_ok = is_ready and await request.app.state.rate_limit_redis.ping()
    except RedisError, TimeoutError:
        redis_ok = False
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
