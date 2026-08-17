"""Failure classification and execution ceiling propagation for Task dispatch."""

from __future__ import annotations

from uuid import uuid4

import httpx
import pytest
from gateway.core.config import TaskServerConfig
from gateway.services.task_dispatch import (
    DispatchFailure,
    RetryableDispatchError,
    TaskDispatcher,
)

_TEST_HMAC_SECRET = "test-hmac-secret"  # noqa: S105 - non-production test credential.
_CONNECTION_REFUSED = "connection refused"
_EXECUTION_CEILING_REACHED = "execution ceiling reached"


def _dispatcher(handler: httpx.AsyncBaseTransport) -> TaskDispatcher:
    return TaskDispatcher(
        {
            "fpocket": TaskServerConfig(
                base_url="http://fpocket.test", hmac_secret=_TEST_HMAC_SECRET
            )
        },
        httpx.AsyncClient(transport=handler),
    )


async def test_dispatch_retries_only_a_known_pre_delivery_connection_failure() -> None:
    def unavailable(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(_CONNECTION_REFUSED, request=request)

    dispatcher = _dispatcher(httpx.MockTransport(unavailable))

    with pytest.raises(RetryableDispatchError):
        await dispatcher.dispatch(
            task_server_name="fpocket",
            task_name="detect_pockets",
            job_id=uuid4(),
            params={},
            timeout_seconds=90,
        )


async def test_dispatch_treats_read_timeout_as_terminal_execution_ceiling() -> None:
    def slow(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout(_EXECUTION_CEILING_REACHED, request=request)

    dispatcher = _dispatcher(httpx.MockTransport(slow))

    outcome = await dispatcher.dispatch(
        task_server_name="fpocket",
        task_name="detect_pockets",
        job_id=uuid4(),
        params={},
        timeout_seconds=90,
    )

    assert isinstance(outcome, DispatchFailure)
    assert outcome.error_detail["error_type"] == "execution_timed_out"


async def test_dispatch_uses_the_task_manifest_execution_ceiling_as_http_timeout() -> None:
    observed_timeout: dict[str, float] = {}

    def accepted(request: httpx.Request) -> httpx.Response:
        observed_timeout.update(request.extensions["timeout"])
        return httpx.Response(200, json={"value": {}, "outputs": []})

    dispatcher = _dispatcher(httpx.MockTransport(accepted))

    await dispatcher.dispatch(
        task_server_name="fpocket",
        task_name="detect_pockets",
        job_id=uuid4(),
        params={},
        timeout_seconds=90,
    )

    assert observed_timeout["connect"] == 5
    assert observed_timeout["read"] == 90
