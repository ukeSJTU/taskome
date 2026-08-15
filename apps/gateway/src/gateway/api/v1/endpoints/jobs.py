"""REST adapters for Job submission and query."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID  # noqa: TC003

from fastapi import APIRouter, Depends, Query, Request, status

from gateway.core.auth import Principal, current_principal
from gateway.core.errors import AppError, problem_responses
from gateway.models.jobs import JobStatus  # noqa: TC001 - FastAPI resolves this at runtime.
from gateway.schemas.jobs import CreateJobRequest, JobListResponse, JobResponse
from gateway.services.jobs import (
    InvalidJobParamsError,
    JobInputFileNotFoundError,
    JobNotFoundError,
    JobService,
    TaskNotFoundError,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])

MAX_LIST_LIMIT = 100


def job_service(request: Request) -> JobService:
    """Resolve the lifespan-owned Job service."""

    return request.app.state.job_service


def job_not_found() -> AppError:
    return AppError(
        error_type="job-not-found",
        title="Job Not Found",
        status_code=status.HTTP_404_NOT_FOUND,
        detail="The requested Job is not available.",
    )


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="createJob",
    responses=problem_responses(400, 401, 404, 422, 503),
)
async def create_job(
    body: CreateJobRequest,
    principal: Annotated[Principal, Depends(current_principal)],
    service: Annotated[JobService, Depends(job_service)],
) -> JobResponse:
    """Validate and durably queue a Job, dispatching it in the background."""

    try:
        record = await service.submit_job(
            principal.user_id, body.task_server_name, body.task_name, body.params
        )
    except TaskNotFoundError as error:
        raise AppError(
            error_type="task-not-found",
            title="Task Not Found",
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested Task is not registered on any known Task Server.",
        ) from error
    except InvalidJobParamsError as error:
        raise AppError(
            error_type="invalid-job-params",
            title="Invalid Job Params",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error
    except JobInputFileNotFoundError as error:
        raise AppError(
            error_type="job-input-file-not-found",
            title="Job Input File Not Found",
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    return JobResponse.model_validate(record)


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    operation_id="getJob",
    responses=problem_responses(400, 401, 404, 422, 503),
)
async def get_job(
    job_id: UUID,
    principal: Annotated[Principal, Depends(current_principal)],
    service: Annotated[JobService, Depends(job_service)],
) -> JobResponse:
    """Return a caller-owned Job's current status and result."""

    try:
        record = await service.get_job(principal.user_id, job_id)
    except JobNotFoundError as error:
        raise job_not_found() from error
    return JobResponse.model_validate(record)


@router.get(
    "",
    response_model=JobListResponse,
    operation_id="listJobs",
    responses=problem_responses(400, 401, 422, 503),
)
async def list_jobs(  # noqa: PLR0913, PLR0917
    principal: Annotated[Principal, Depends(current_principal)],
    service: Annotated[JobService, Depends(job_service)],
    status_filter: Annotated[JobStatus | None, Query(alias="status")] = None,
    task_name: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_LIST_LIMIT)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobListResponse:
    """List the caller's own Jobs, newest first."""

    records = await service.list_jobs(
        principal.user_id,
        status=status_filter,
        task_name=task_name,
        limit=limit,
        offset=offset,
    )
    return JobListResponse(jobs=[JobResponse.model_validate(record) for record in records])
