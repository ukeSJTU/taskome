"""Taskiq-backed durable intake for Gateway Jobs."""

from __future__ import annotations

from typing import TYPE_CHECKING

from taskiq_redis import RedisStreamBroker

if TYPE_CHECKING:
    from uuid import UUID

    from taskiq.abc.broker import AsyncBroker


class TaskiqJobQueue:
    """Enqueue Job claims on the Redis stream consumed by the Gateway Worker."""

    def __init__(self, redis_url: str) -> None:
        self._broker: AsyncBroker = RedisStreamBroker(url=redis_url)

    async def start(self) -> None:
        """Start the client-side broker resources during API lifespan startup."""

        await self._broker.startup()

    async def aclose(self) -> None:
        """Release client-side broker resources during API lifespan shutdown."""

        await self._broker.shutdown()

    async def enqueue_claim(self, job_id: UUID) -> None:
        """Durably send one queued Job to the worker's claim phase."""

        from gateway.worker import claim_job  # noqa: PLC0415 - avoids queue/worker import cycle.

        await claim_job.kicker().with_broker(self._broker).kiq(str(job_id))

    async def enqueue_dispatch(self, job_id: UUID) -> None:
        """Durably send a claimed Job to the worker execution phase."""

        from gateway.worker import execute_dispatch  # noqa: PLC0415 - see enqueue_claim.

        await execute_dispatch.kicker().with_broker(self._broker).kiq(str(job_id))
