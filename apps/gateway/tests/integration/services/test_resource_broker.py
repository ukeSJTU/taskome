"""CPU-only Ray admission control for the Gateway Worker's resource broker."""

from __future__ import annotations

import asyncio
from pathlib import Path

import ray
from gateway.services.resource_broker import RayResourceBroker
from task_kit import TaskResources

_WORKSPACE_ROOT = Path(__file__).parents[5]


async def test_ray_resource_broker_reserves_and_releases_declared_cpu_capacity() -> None:
    ray.init(num_cpus=2, runtime_env={"working_dir": str(_WORKSPACE_ROOT)})
    broker = RayResourceBroker("local")
    try:
        assert ray.available_resources()["CPU"] == 2

        async with broker.reserve(TaskResources(num_cpus=2)):
            for _ in range(10):
                if ray.available_resources().get("CPU", 0) == 0:
                    break
                await asyncio.sleep(0.1)
            assert ray.available_resources().get("CPU", 0) == 0

        for _ in range(10):
            if ray.available_resources().get("CPU") == 2:
                break
            await asyncio.sleep(0.1)
        assert ray.available_resources().get("CPU") == 2
    finally:
        ray.shutdown()
