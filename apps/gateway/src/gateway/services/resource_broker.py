"""Ray-backed CPU/GPU admission control for Gateway Worker dispatch."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import ray
from ray.util.queue import Queue

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from task_kit import TaskResources


@ray.remote
def _hold_resources(acquired: Queue, release: Queue) -> None:
    """Hold one Ray task's reservation until the dispatching process releases it."""

    acquired.put(None)
    release.get()


class RayResourceBroker:
    """Reserve Task-declared Ray capacity around one external dispatch call."""

    def __init__(self, address: str) -> None:
        self._address = address

    async def start(self) -> None:
        if not ray.is_initialized():
            await asyncio.to_thread(ray.init, address=self._address)

    @asynccontextmanager
    async def reserve(self, resources: TaskResources) -> AsyncIterator[None]:
        await self.start()
        acquired = Queue(actor_options={"num_cpus": 0})
        release = Queue(actor_options={"num_cpus": 0})
        reservation = _hold_resources.options(
            num_cpus=resources.num_cpus,
            num_gpus=resources.num_gpus,
        ).remote(acquired, release)
        await asyncio.to_thread(acquired.get)
        try:
            yield
        finally:
            await asyncio.to_thread(release.put, None)
            await asyncio.to_thread(ray.get, reservation)
