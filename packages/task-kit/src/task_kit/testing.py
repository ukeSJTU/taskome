"""Supported test helpers for Task authors and task-kit consumers."""
# ruff: noqa: TC003

from __future__ import annotations

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


class _AllowUnsignedRequests:
    def verify(self, request: SignedGatewayRequest) -> VerifiedGatewayRequest:
        del request
        return VerifiedGatewayRequest(job_id=None, traceparent=None)


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


def fake_runtime(*, workdir_root: Path | None = None) -> TaskServerRuntime:
    """Return an external-boundary fake while preserving the real execution core."""
    return TaskServerRuntime(
        gateway_requests=_AllowUnsignedRequests(),
        input_files=_NoInputFiles(),
        outputs=_InMemoryOutputs(),
        logger=structlog.get_logger(),
        workdir_root=workdir_root,
    )
