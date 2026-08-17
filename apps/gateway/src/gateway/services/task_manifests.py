"""Fetch and cache each registered Task Server's manifest (params/result JSON Schema).

Gateway never imports a Task Server's Python types (e.g. `fpocket_server`'s Params
models) -- adding a new Task Server would otherwise require a Gateway dependency
change. Instead it works from each Task Server's own published JSON Schema, kept
current by one fetch per server at startup.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import structlog
from task_kit import TaskResources
from task_kit.runtime import sign_gateway_request

if TYPE_CHECKING:
    from collections.abc import Mapping

    import httpx

    from gateway.core.config import TaskServerConfig

_MANIFEST_TARGET = "/internal/manifest"


@dataclass(frozen=True, slots=True)
class TaskManifest:
    """One Task's curated params/result JSON Schema, as published by its Task Server."""

    task_server_name: str
    task_name: str
    description: str
    params_schema: dict[str, Any]
    result_schema: dict[str, Any]
    schema_version: int
    resources: TaskResources
    max_duration_seconds: int


TaskManifestRegistry = dict[str, dict[str, TaskManifest]]


async def fetch_task_manifests(
    task_servers: Mapping[str, TaskServerConfig],
    client: httpx.AsyncClient,
) -> TaskManifestRegistry:
    """Fetch every registered Task Server's manifest once, HMAC-signed (ADR-0007).

    A Task Server that is unreachable or returns a malformed manifest is logged and
    omitted from the registry -- it does not fail Gateway startup, since other
    Gateway capabilities (Input Files, auth, health) do not depend on it.
    """

    logger = structlog.get_logger()
    registry: TaskManifestRegistry = {}
    for server_name, config in task_servers.items():
        headers = sign_gateway_request(
            config.hmac_secret,
            method="GET",
            target=_MANIFEST_TARGET,
            body=b"",
        )
        try:
            response = await client.get(f"{config.base_url}{_MANIFEST_TARGET}", headers=headers)
            response.raise_for_status()
            body = response.json()
            registry[server_name] = {
                task["name"]: TaskManifest(
                    task_server_name=server_name,
                    task_name=task["name"],
                    description=task["description"],
                    params_schema=task["params_schema"],
                    result_schema=task["result_schema"],
                    schema_version=body["schema_version"],
                    resources=TaskResources(**task["resources"]),
                    max_duration_seconds=task["max_duration_seconds"],
                )
                for task in body["tasks"]
            }
        except Exception:  # noqa: BLE001 - a down/malformed Task Server must not fail startup.
            logger.warning("task_manifest_fetch_failed", task_server_name=server_name)
    return registry
