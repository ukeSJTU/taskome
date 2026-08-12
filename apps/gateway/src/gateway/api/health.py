from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response, status

from gateway.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def liveness() -> HealthResponse:
    return HealthResponse(status="alive", timestamp=datetime.now(UTC))


@router.get("/ready")
async def readiness(request: Request, response: Response) -> ReadinessResponse:
    is_ready = getattr(request.app.state, "ready", False)
    database_ok = is_ready and await request.app.state.database.is_available()
    if not database_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(
        status="ready" if database_ok else "not_ready",
        timestamp=datetime.now(UTC),
        checks={"database": {"status": "ok" if database_ok else "error"}},
    )
