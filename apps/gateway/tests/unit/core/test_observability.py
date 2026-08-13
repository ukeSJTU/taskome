from __future__ import annotations

import json
import time
from typing import TYPE_CHECKING, cast

import pytest
from fastapi.testclient import TestClient
from gateway.core.observability import Observability
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI
    from opentelemetry.sdk._logs import LoggerProvider
    from opentelemetry.sdk.trace import TracerProvider


def test_http_requests_emit_server_spans(create_test_app: Callable[..., FastAPI]) -> None:
    exporter = InMemorySpanExporter()
    app = create_test_app(span_exporter=exporter)

    with TestClient(app) as client:
        client.get("/health/live")

    server_spans = [span for span in exporter.get_finished_spans() if span.kind.name == "SERVER"]
    assert len(server_spans) == 1
    attributes = server_spans[0].attributes
    assert attributes is not None
    assert attributes["http.route"] == "/health/live"


def test_access_logs_are_exported_through_otel(create_test_app: Callable[..., FastAPI]) -> None:
    exporter = InMemoryLogRecordExporter()
    app = create_test_app(log_exporter=exporter)

    with TestClient(app) as client:
        client.get("/does-not-exist")

    bodies = [record.log_record.body for record in exporter.get_finished_logs()]
    access_log = next(
        json.loads(body)
        for body in bodies
        if isinstance(body, str) and '"event": "http_request"' in body
    )
    assert access_log["status_code"] == 404


@pytest.mark.asyncio
async def test_observability_flush_uses_the_configured_deadline() -> None:
    received_timeouts: list[int] = []

    class Provider:
        def force_flush(self, timeout_millis: int) -> bool:
            received_timeouts.append(timeout_millis)
            return True

        def shutdown(self) -> None:
            pass

    provider = Provider()
    observability = Observability(
        tracer_provider=cast("TracerProvider", provider),
        logger_provider=cast("LoggerProvider", provider),
        shutdown_timeout_seconds=0.05,
    )

    await observability.shutdown()

    assert received_timeouts == [50, 50]


@pytest.mark.asyncio
async def test_observability_shutdown_returns_when_a_provider_stalls() -> None:
    shutdown_calls: list[str] = []

    class Provider:
        def force_flush(self, _timeout_millis: int) -> bool:
            return True

        def shutdown(self) -> None:
            shutdown_calls.append("started")
            time.sleep(0.2)

    provider = Provider()
    observability = Observability(
        tracer_provider=cast("TracerProvider", provider),
        logger_provider=cast("LoggerProvider", provider),
        shutdown_timeout_seconds=0.01,
    )
    started = time.monotonic()

    await observability.shutdown()

    assert time.monotonic() - started < 0.1
    assert shutdown_calls == ["started", "started"]
