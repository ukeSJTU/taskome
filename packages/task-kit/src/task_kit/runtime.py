"""Runtime ports shared by production and test Task Server assembly."""
# ruff: noqa: EM101, TC001, TC003, TRY003, UP035

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Collection, Mapping, Protocol
from uuid import UUID

import anyio
import structlog

from .types import InputFileId


@dataclass(frozen=True, slots=True)
class SignedGatewayRequest:
    timestamp: str | None
    signature: str | None
    method: str
    target: str
    body: bytes
    job_id: str | None
    traceparent: str | None


@dataclass(frozen=True, slots=True)
class VerifiedGatewayRequest:
    job_id: UUID | None
    traceparent: str | None


class GatewayRequestVerifier(Protocol):
    def verify(self, request: SignedGatewayRequest) -> VerifiedGatewayRequest: ...


class InputFileResolver(Protocol):
    async def materialize(
        self, job_id: UUID, input_file_ids: Collection[InputFileId], destination_dir: Path
    ) -> Mapping[InputFileId, Path]: ...


@dataclass(frozen=True, slots=True)
class ValidatedProducedFile:
    name: str
    path: Path
    media_type: str
    download_name: str | None
    size_bytes: int
    sha256: str


@dataclass(frozen=True, slots=True)
class PublishedOutput:
    name: str
    storage_key: str
    media_type: str
    download_name: str | None
    size_bytes: int
    sha256: str


class OutputPublisher(Protocol):
    async def publish(
        self, server_name: str, job_id: UUID, files: Collection[ValidatedProducedFile]
    ) -> tuple[PublishedOutput, ...]: ...


@dataclass(slots=True)
class TaskServerRuntime:
    gateway_requests: GatewayRequestVerifier
    input_files: InputFileResolver
    outputs: OutputPublisher
    logger: structlog.stdlib.BoundLogger = field(default_factory=structlog.get_logger)
    workdir_root: Path | None = None
    max_concurrent_jobs: int = 1
    limiter: anyio.CapacityLimiter = field(init=False)

    def __post_init__(self) -> None:
        if self.max_concurrent_jobs < 1:
            raise ValueError("max_concurrent_jobs must be positive")
        self.limiter = anyio.CapacityLimiter(self.max_concurrent_jobs)
