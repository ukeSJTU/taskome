"""Dispatch one Job to its Task Server over HMAC-signed internal REST (ADR-0004/0007)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import httpx
from task_kit.runtime import sign_gateway_request

if TYPE_CHECKING:
    from collections.abc import Mapping
    from uuid import UUID

    from gateway.core.config import TaskServerConfig

_DEFAULT_ERROR_TYPE = "dispatch_failed"


@dataclass(frozen=True, slots=True)
class DispatchSuccess:
    """The Task Server executed the Task and returned its result envelope."""

    result: dict[str, Any]


@dataclass(frozen=True, slots=True)
class DispatchFailure:
    """The Task Server rejected the Task, failed to execute it, or was unreachable."""

    error_detail: dict[str, Any]


DispatchOutcome = DispatchSuccess | DispatchFailure


class RetryableDispatchError(Exception):
    """A connection failure known to have happened before Task Server receipt."""


class TaskDispatcher:
    """Sign and send one Job's Params to its Task Server, over `httpx`."""

    def __init__(
        self,
        task_servers: Mapping[str, TaskServerConfig],
        client: httpx.AsyncClient,
    ) -> None:
        self._task_servers = task_servers
        self._client = client

    async def dispatch(
        self,
        *,
        task_server_name: str,
        task_name: str,
        job_id: UUID,
        params: dict[str, Any],
        timeout_seconds: int = 30,
    ) -> DispatchOutcome:
        """Call `POST /internal/tasks/{task_name}`, translating the result or failure."""

        config = self._task_servers[task_server_name]
        target = f"/internal/tasks/{task_name}"
        body = json.dumps(params, separators=(",", ":")).encode()
        headers = sign_gateway_request(
            config.hmac_secret,
            method="POST",
            target=target,
            body=body,
            job_id=job_id,
        )
        headers["content-type"] = "application/json"
        try:
            response = await self._client.post(
                f"{config.base_url}{target}",
                content=body,
                headers=headers,
                timeout=httpx.Timeout(timeout_seconds, connect=min(5, timeout_seconds)),
            )
        except (httpx.ConnectError, httpx.ConnectTimeout) as error:
            raise RetryableDispatchError from error
        except httpx.ReadTimeout:
            return DispatchFailure(
                error_detail={
                    "error_type": "execution_timed_out",
                    "detail": "The Task Server exceeded this Task's execution ceiling.",
                }
            )
        except httpx.HTTPError:
            return DispatchFailure(
                error_detail={
                    "error_type": "dispatch_ambiguous_failure",
                    "detail": "Task Server dispatch failed after the request may have been sent.",
                }
            )
        if response.status_code == httpx.codes.OK:
            return DispatchSuccess(result=response.json())
        return DispatchFailure(error_detail=_error_detail(response))


def _error_detail(response: httpx.Response) -> dict[str, Any]:
    try:
        problem = response.json()
    except ValueError:
        return {"error_type": _DEFAULT_ERROR_TYPE, "detail": "Task execution failed."}
    error_type = str(problem.get("type", "")).rsplit(":", 1)[-1] or _DEFAULT_ERROR_TYPE
    detail = problem.get("detail") or "Task execution failed."
    return {"error_type": error_type, "detail": detail}
