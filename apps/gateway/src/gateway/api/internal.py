"""Internal, HMAC-signed REST called by Task Servers (ADR-0007), never by Access Channels.

Excluded from the public OpenAPI schema -- this is the Gateway-to-Task-Server wire
protocol task-kit's `GatewayInputFileResolver` already speaks, not a curated Task
capability, so it belongs outside the `/v1` contract entirely.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from task_kit.runtime import GatewayHMACVerifier, SignedGatewayRequest

from gateway.core.errors import AppError
from gateway.services.input_files import InputFileNotFoundError
from gateway.services.jobs import JobNotFoundError

if TYPE_CHECKING:
    from gateway.services.input_files import InputFileService
    from gateway.services.jobs import JobService

router = APIRouter(prefix="/internal", include_in_schema=False)

_SIGNATURE_MAX_AGE_SECONDS = 300


def _unauthorized() -> AppError:
    return AppError(
        error_type="unauthorized",
        title="Unauthorized",
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Gateway request.",
    )


@router.post("/jobs/{job_id}/input-files/resolve")
async def resolve_job_input_files(job_id: UUID, request: Request) -> JSONResponse:
    """Let a Job's own Task Server resolve the Input Files its Params reference."""

    job_service: JobService = request.app.state.job_service
    input_file_service: InputFileService = request.app.state.input_file_service
    task_servers = request.app.state.settings.task_servers

    try:
        job = await job_service.get_job_for_dispatch(job_id)
    except JobNotFoundError as error:
        raise AppError(
            error_type="job-not-found",
            title="Job Not Found",
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        ) from error

    config = task_servers.get(job.task_server_name)
    if config is None:
        raise _unauthorized()

    body = await request.body()
    try:
        verified = GatewayHMACVerifier(config.hmac_secret, _SIGNATURE_MAX_AGE_SECONDS).verify(
            SignedGatewayRequest(
                timestamp=request.headers.get("x-taskome-timestamp"),
                signature=request.headers.get("x-taskome-signature"),
                method=request.method,
                target=request.url.path,
                body=body,
                job_id=request.headers.get("x-taskome-job-id"),
                traceparent=request.headers.get("traceparent"),
            )
        )
    except ValueError as error:
        raise _unauthorized() from error
    if verified.job_id != job_id:
        raise _unauthorized()

    input_file_ids = _parse_input_file_ids(body)
    if input_file_ids is None:
        raise AppError(
            error_type="invalid-request",
            title="Invalid Request",
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed request body.",
        )

    try:
        resolved = await input_file_service.resolve_for_dispatch(job.owner_user_id, input_file_ids)
    except InputFileNotFoundError as error:
        raise AppError(
            error_type="input-file-not-found",
            title="Input File Not Found",
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Input File not found.",
        ) from error

    return JSONResponse(
        {
            "input_files": [
                {"id": str(item.id), "url": item.download_url, "size_bytes": item.size_bytes}
                for item in resolved
            ]
        }
    )


def _parse_input_file_ids(body: bytes) -> list[UUID] | None:
    try:
        payload: Any = json.loads(body)
        return [UUID(value) for value in payload["input_file_ids"]]
    except json.JSONDecodeError, KeyError, TypeError, ValueError:
        return None
