"""Strict REST and MCP boundary models for Jobs."""

from datetime import datetime  # noqa: TC003
from typing import Annotated, Any
from uuid import UUID  # noqa: TC003

from pydantic import BaseModel, ConfigDict, Field

from gateway.models.jobs import JobStatus  # noqa: TC001 - Pydantic resolves this at runtime.

MAX_TASK_NAME_LENGTH = 63
TaskIdentifier = Annotated[str, Field(strict=True, min_length=1, max_length=MAX_TASK_NAME_LENGTH)]


class CreateJobRequest(BaseModel):
    """Validated REST input for submitting one Job."""

    model_config = ConfigDict(strict=True)

    task_server_name: TaskIdentifier
    task_name: TaskIdentifier
    params: dict[str, Any]


class JobResponse(BaseModel):
    """Caller-visible Job state, frozen params, and result."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: JobStatus
    task_server_name: str
    task_name: str
    params: dict[str, Any]
    params_schema_version: int
    result: dict[str, Any] | None
    error_detail: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class JobListResponse(BaseModel):
    """A page of the caller's own Jobs, newest first."""

    model_config = ConfigDict(from_attributes=True)

    jobs: list[JobResponse]
