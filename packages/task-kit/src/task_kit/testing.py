"""Supported test helpers for Task authors and task-kit consumers."""
# ruff: noqa: EM101, S105, TC003, TRY003

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Collection
from pathlib import Path
from uuid import UUID

import structlog

from .runtime import (
    PublishedOutput,
    SignedGatewayRequest,
    TaskServerRuntime,
    ValidatedProducedFile,
    VerifiedGatewayRequest,
)
from .types import ComputeContext, InputFileId

TEST_GATEWAY_HMAC_SECRET = "task-kit-test-secret-0123456789"


def signed_request_headers(
    *, method: str, target: str, body: bytes, job_id: UUID | None = None
) -> dict[str, str]:
    """Build deterministic Gateway HMAC headers for REST contract tests."""
    timestamp = "0"
    job = "" if job_id is None else str(job_id)
    canonical = "\n".join(
        (
            "taskome-v1",
            timestamp,
            method.upper(),
            target,
            job,
            "",
            hashlib.sha256(body).hexdigest(),
        )
    )
    headers = {
        "X-Taskome-Timestamp": timestamp,
        "X-Taskome-Signature": hmac.new(
            TEST_GATEWAY_HMAC_SECRET.encode(), canonical.encode(), hashlib.sha256
        ).hexdigest(),
    }
    if job_id is not None:
        headers["X-Taskome-Job-Id"] = job
    return headers


class _TestGatewayVerifier:
    def verify(self, request: SignedGatewayRequest) -> VerifiedGatewayRequest:
        if request.timestamp is None or request.signature is None:
            raise ValueError("missing Gateway signature")
        headers = signed_request_headers(
            method=request.method,
            target=request.target,
            body=request.body,
            job_id=UUID(request.job_id) if request.job_id else None,
        )
        if not hmac.compare_digest(headers["X-Taskome-Signature"], request.signature):
            raise ValueError("invalid Gateway signature")
        return VerifiedGatewayRequest(
            job_id=UUID(request.job_id) if request.job_id else None,
            traceparent=request.traceparent,
        )


class _NoInputFiles:
    async def materialize(
        self, job_id: UUID, input_file_ids: object, destination_dir: Path
    ) -> dict:
        del job_id, input_file_ids, destination_dir
        return {}


class _InMemoryOutputs:
    async def publish(
        self, server_name: str, job_id: UUID, files: Collection[ValidatedProducedFile]
    ) -> tuple[PublishedOutput, ...]:
        del server_name, job_id
        return tuple(
            PublishedOutput(
                name=file.name,
                storage_key=f"test/{file.name}",
                media_type=file.media_type,
                download_name=file.download_name,
                size_bytes=file.size_bytes,
                sha256=file.sha256,
            )
            for file in files
        )


def fake_runtime(
    *,
    workdir_root: Path | None = None,
    docs_enabled: bool = False,
    request_body_max_bytes: int = 4 * 1024 * 1024,
    mcp_message_max_bytes: int = 1024 * 1024,
) -> TaskServerRuntime:
    """Return an external-boundary fake while preserving the real execution core."""
    return TaskServerRuntime(
        gateway_requests=_TestGatewayVerifier(),
        input_files=_NoInputFiles(),
        outputs=_InMemoryOutputs(),
        logger=structlog.get_logger(),
        workdir_root=workdir_root,
        docs_enabled=docs_enabled,
        request_body_max_bytes=request_body_max_bytes,
        mcp_message_max_bytes=mcp_message_max_bytes,
    )


def compute_context(
    *, workdir: Path, input_paths: dict[InputFileId, Path] | None = None
) -> ComputeContext:
    """Build a legitimate adapter context without importing runtime internals."""
    return ComputeContext(
        workdir=workdir,
        logger=structlog.get_logger(),
        _input_paths={} if input_paths is None else input_paths,
    )
