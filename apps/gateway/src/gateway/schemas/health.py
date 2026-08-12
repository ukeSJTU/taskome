from typing import Literal

from pydantic import AwareDatetime, BaseModel


class HealthResponse(BaseModel):
    status: Literal["alive", "ready", "not_ready"]
    timestamp: AwareDatetime


class ReadinessResponse(HealthResponse):
    checks: dict[str, dict[str, str]]
