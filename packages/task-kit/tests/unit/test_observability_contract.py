# ruff: noqa: EM101, PLR2004, S101, S106

import json
from uuid import UUID

import time_machine
from fastapi.testclient import TestClient
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic import BaseModel
from task_kit import (
    ComputeContext,
    ComputeExecutionError,
    ComputeResult,
    TaskDefinition,
    build_task_server,
)
from task_kit.runtime import TaskServerSettings, build_runtime
from task_kit.testing import TEST_GATEWAY_HMAC_SECRET, signed_request_headers


class Params(BaseModel):
    message: str


class Result(BaseModel):
    message: str


class Adapter:
    def run(self, params: Params, ctx: ComputeContext) -> ComputeResult[Result]:
        del ctx
        return ComputeResult(value=Result(message=params.message))


class FailingAdapter:
    def run(self, params: Params, ctx: ComputeContext) -> ComputeResult[Result]:
        del params, ctx
        raise ComputeExecutionError("sensitive-tool-stderr-canary")


def _settings() -> TaskServerSettings:
    return TaskServerSettings(
        app_environment="production",
        gateway_internal_url="https://gateway.test",
        gateway_task_hmac_secret=TEST_GATEWAY_HMAC_SECRET,
        seaweedfs_internal_endpoint="https://seaweedfs.test",
        seaweedfs_access_key="task-server",
        seaweedfs_secret_key="task-server-secret",
    )


def test_lifespan_owned_observability_exports_server_spans() -> None:
    exporter = InMemorySpanExporter()
    runtime = build_runtime(_settings(), span_exporter=exporter)
    app = build_task_server(
        name="echo",
        tasks=(TaskDefinition("echo", "Echo a message.", Params, Result, Adapter()),),
        runtime=runtime,
    )

    with TestClient(app) as client:
        assert client.get("/health/live").status_code == 200

    server_spans = [span for span in exporter.get_finished_spans() if span.kind.name == "SERVER"]
    assert len(server_spans) == 1
    assert server_spans[0].attributes["http.route"] == "/health/live"


def test_compute_failure_logs_safe_classification_without_sensitive_content() -> None:
    exporter = InMemoryLogRecordExporter()
    runtime = build_runtime(_settings(), log_exporter=exporter)
    app = build_task_server(
        name="failure",
        tasks=(
            TaskDefinition(
                "fail",
                "Fail safely.",
                Params,
                Result,
                FailingAdapter(),
            ),
        ),
        runtime=runtime,
    )
    body = b'{"message":"sensitive-sequence-canary"}'
    headers = signed_request_headers(
        method="POST",
        target="/internal/tasks/fail",
        body=body,
        job_id=UUID("00000000-0000-0000-0000-000000000020"),
    )

    with time_machine.travel(0), TestClient(app) as client:
        response = client.post("/internal/tasks/fail", headers=headers, content=body)

    assert response.status_code == 500
    assert response.json()["detail"] == "Task execution failed."
    events = [
        json.loads(record.log_record.body)
        for record in exporter.get_finished_logs()
        if isinstance(record.log_record.body, str) and record.log_record.body.startswith("{")
    ]
    failure = next(event for event in events if event["event"] == "task_compute_failed")
    assert failure["failure_type"] == "ComputeExecutionError"
    serialized_events = json.dumps(events)
    assert "sensitive-tool-stderr-canary" not in serialized_events
    assert "sensitive-sequence-canary" not in serialized_events
