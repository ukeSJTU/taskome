from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response, status

from gateway.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def liveness() -> HealthResponse:
    return HealthResponse(status="alive", timestamp=datetime.now(UTC))


@router.get("/ready")
def readiness(request: Request, response: Response) -> ReadinessResponse:
    is_ready = getattr(request.app.state, "ready", False)
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(
        status="ready" if is_ready else "not_ready",
        timestamp=datetime.now(UTC),
        checks={},
    )
