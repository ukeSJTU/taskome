from __future__ import annotations

import json
from typing import TYPE_CHECKING

from fastapi.testclient import TestClient
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


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
