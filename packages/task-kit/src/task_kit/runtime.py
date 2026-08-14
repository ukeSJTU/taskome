"""Runtime ports shared by production and test Task Server assembly."""
# ruff: noqa: EM101, TC001, TC003, TRY003, UP035

from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Collection, Mapping, Protocol
from uuid import UUID

import anyio
import structlog

from .types import InputFileId

_RECENT_JOB_LIMIT = 10_000


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
    active_jobs: set[UUID] = field(default_factory=set, init=False)
    completed_jobs: OrderedDict[UUID, None] = field(default_factory=OrderedDict, init=False)
    job_lock: anyio.Lock = field(default_factory=anyio.Lock, init=False)

    def __post_init__(self) -> None:
        if self.max_concurrent_jobs < 1:
            raise ValueError("max_concurrent_jobs must be positive")
        self.limiter = anyio.CapacityLimiter(self.max_concurrent_jobs)

    async def claim_job(self, job_id: UUID) -> bool:
        async with self.job_lock:
            if job_id in self.active_jobs or job_id in self.completed_jobs:
                return False
            self.active_jobs.add(job_id)
            return True

    async def complete_job(self, job_id: UUID) -> None:
        async with self.job_lock:
            self.active_jobs.discard(job_id)
            self.completed_jobs[job_id] = None
            self.completed_jobs.move_to_end(job_id)
            while len(self.completed_jobs) > _RECENT_JOB_LIMIT:
                self.completed_jobs.popitem(last=False)
