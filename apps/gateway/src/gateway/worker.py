"""Taskiq entrypoint for the separately-running Gateway Worker process."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING
from uuid import UUID

import httpx
from taskiq import TaskiqEvents
from taskiq.middlewares import SmartRetryMiddleware
from taskiq_redis import RedisStreamBroker

from gateway.core.config import Settings
from gateway.db.database import Database
from gateway.repositories.jobs import JobRepository
from gateway.services.job_dispatch import JobDispatchService
from gateway.services.job_queue import TaskiqJobQueue
from gateway.services.resource_broker import RayResourceBroker
from gateway.services.task_dispatch import TaskDispatcher
from gateway.services.task_manifests import fetch_task_manifests

if TYPE_CHECKING:
    from taskiq.state import TaskiqState


broker = RedisStreamBroker(
    url=os.environ.get("REDIS_URL", "redis://localhost:6379/0")
).with_middlewares(
    SmartRetryMiddleware(
        default_retry_count=3,
        default_delay=1,
        use_jitter=True,
        use_delay_exponent=True,
        max_delay_exponent=30,
    )
)
_worker: JobDispatchService | None = None
_database: Database | None = None
_dispatch_client: httpx.AsyncClient | None = None
_queue: TaskiqJobQueue | None = None
_WORKER_NOT_STARTED = "Gateway Worker has not started"


@broker.on_event(TaskiqEvents.WORKER_STARTUP)
async def start_worker(_state: TaskiqState) -> None:
    """Construct the worker-owned external clients once per worker process."""

    global _worker, _database, _dispatch_client, _queue  # noqa: PLW0603
    settings = Settings()
    _database = Database(settings.database_url.get_secret_value())
    _database.start()
    _dispatch_client = httpx.AsyncClient(timeout=httpx.Timeout(30, connect=5))
    manifests = await fetch_task_manifests(settings.task_servers, _dispatch_client)
    _queue = TaskiqJobQueue(settings.redis_url.get_secret_value())
    await _queue.start()
    _worker = JobDispatchService(
        repository=JobRepository(_database),
        queue=_queue,
        dispatcher=TaskDispatcher(settings.task_servers, _dispatch_client),
        resources=RayResourceBroker(settings.ray_address),
        manifests=manifests,
    )


@broker.on_event(TaskiqEvents.WORKER_SHUTDOWN)
async def stop_worker(_state: TaskiqState) -> None:
    """Close worker-owned external clients during process shutdown."""

    global _worker, _database, _dispatch_client, _queue  # noqa: PLW0603
    if _queue is not None:
        await _queue.aclose()
    if _dispatch_client is not None:
        await _dispatch_client.aclose()
    if _database is not None:
        await _database.dispose()
    _worker = None
    _database = None
    _dispatch_client = None
    _queue = None


def _require_worker() -> JobDispatchService:
    if _worker is None:
        raise RuntimeError(_WORKER_NOT_STARTED)
    return _worker


@broker.task
async def claim_job(job_id: str) -> None:
    """Claim a queued Job before enqueueing the independently retried execution phase."""

    await _require_worker().claim_job(UUID(job_id))


@broker.task(retry_on_error=True, max_retries=3)
async def execute_dispatch(job_id: str) -> None:
    """Execute one claimed Job; only known pre-delivery failures are retried."""

    await _require_worker().execute_dispatch(UUID(job_id))
