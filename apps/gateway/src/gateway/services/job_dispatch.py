"""Gateway Worker orchestration for the two-phase Job dispatch chain."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any, Protocol

from gateway.models.jobs import JobStatus
from gateway.services.task_dispatch import DispatchSuccess, RetryableDispatchError

if TYPE_CHECKING:
    from contextlib import AbstractAsyncContextManager
    from uuid import UUID

    from task_kit import TaskResources

    from gateway.services.jobs import JobRepositoryPort
    from gateway.services.task_dispatch import DispatchOutcome
    from gateway.services.task_manifests import TaskManifestRegistry


class DispatchQueuePort(Protocol):
    """The second phase of the durable Gateway Worker task chain."""

    async def enqueue_dispatch(self, job_id: UUID) -> None: ...


class DispatcherPort(Protocol):
    """The signed HTTP handoff to a Task Server."""

    async def dispatch(
        self,
        *,
        task_server_name: str,
        task_name: str,
        job_id: UUID,
        params: dict[str, Any],
        timeout_seconds: int,
    ) -> DispatchOutcome: ...


class ResourceBrokerPort(Protocol):
    """Reserve a Task's declared capacity for the duration of dispatch."""

    def reserve(self, resources: TaskResources) -> AbstractAsyncContextManager[None]: ...


class JobDispatchService:
    """Claim queued Jobs and hand claimed IDs to the execution phase."""

    def __init__(
        self,
        *,
        repository: JobRepositoryPort,
        queue: DispatchQueuePort,
        dispatcher: DispatcherPort,
        resources: ResourceBrokerPort,
        manifests: TaskManifestRegistry,
    ) -> None:
        self._repository = repository
        self._queue = queue
        self._dispatcher = dispatcher
        self._resources = resources
        self._manifests = manifests

    async def claim_job(self, job_id: UUID) -> None:
        """Atomically claim a queued Job, no-oping after an earlier claim."""

        record = await self._repository.mark_running(job_id)
        if record is not None:
            await self._queue.enqueue_dispatch(job_id)

    async def execute_dispatch(self, job_id: UUID) -> None:
        """Reserve capacity, dispatch one claimed Job, and persist its terminal outcome."""

        record = await self._repository.find_by_id(job_id)
        if record is None or record.status is not JobStatus.RUNNING:
            return
        manifest = self._manifests.get(record.task_server_name, {}).get(record.task_name)
        if manifest is None:
            await self._repository.mark_failed(
                job_id,
                error_detail={
                    "error_type": "task_not_found",
                    "detail": "Task is no longer registered.",
                },
            )
            return
        try:
            heartbeat = asyncio.create_task(self._heartbeat_until_done(job_id))
            try:
                async with self._resources.reserve(manifest.resources):
                    outcome = await self._dispatcher.dispatch(
                        task_server_name=record.task_server_name,
                        task_name=record.task_name,
                        job_id=job_id,
                        params=record.params,
                        timeout_seconds=manifest.max_duration_seconds,
                    )
            finally:
                heartbeat.cancel()
                await asyncio.gather(heartbeat, return_exceptions=True)
        except RetryableDispatchError:
            raise
        except Exception:  # noqa: BLE001 - worker failures become a terminal Job state.
            await self._repository.mark_failed(
                job_id,
                error_detail={"error_type": "dispatch_failed", "detail": "Job dispatch failed."},
            )
            return
        if isinstance(outcome, DispatchSuccess):
            await self._repository.mark_completed(job_id, result=outcome.result)
        else:
            await self._repository.mark_failed(job_id, error_detail=outcome.error_detail)

    async def _heartbeat_until_done(self, job_id: UUID) -> None:
        while True:
            await asyncio.sleep(20)
            await self._repository.touch_heartbeat(job_id)
