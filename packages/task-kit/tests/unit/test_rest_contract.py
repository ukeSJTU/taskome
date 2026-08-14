# ruff: noqa: PLR2004, S101

import json
from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from task_kit import (
    ComputeContext,
    ComputeResult,
    ProducedFile,
    TaskDefinition,
    build_task_server,
)
from task_kit.testing import fake_runtime, signed_request_headers


class EchoParams(BaseModel):
    message: str = Field(alias="text")


class EchoResult(BaseModel):
    message: str


class NestedParams(BaseModel):
    payload: EchoParams


class EchoAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=params.message))


class OutputAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        output = ctx.workdir / "result.txt"
        output.write_text(params.message)
        return ComputeResult(
            value=EchoResult(message=params.message),
            files=(
                ProducedFile(
                    name="result",
                    path=Path("result.txt"),
                    media_type="text/plain",
                    download_name="result.txt",
                ),
            ),
        )


class SymlinkOutputAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        source = ctx.workdir / "source.txt"
        source.write_text(params.message)
        (ctx.workdir / "result.txt").symlink_to(source)
        return ComputeResult(
            value=EchoResult(message=params.message),
            files=(ProducedFile(name="result", path=Path("result.txt"), media_type="text/plain"),),
        )


class NestedAdapter:
    def run(self, params: NestedParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=params.payload.message))


def _signed_json(payload: object, job_id: str) -> tuple[bytes, dict[str, str]]:
    body = json.dumps(payload, separators=(",", ":")).encode()
    headers = signed_request_headers(
        method="POST", target="/internal/tasks/echo", body=body, job_id=UUID(job_id)
    )
    headers["content-type"] = "application/json"
    return body, headers


def test_signed_rest_executes_a_flat_params_object() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        body, headers = _signed_json({"text": "hello"}, "00000000-0000-0000-0000-000000000001")
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 200
    assert response.json() == {"value": {"message": "hello"}, "outputs": []}


def test_manifest_describes_the_flat_alias_schema() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        response = client.get(
            "/internal/manifest",
            headers=signed_request_headers(method="GET", target="/internal/manifest", body=b""),
        )

    assert response.status_code == 200
    assert response.json()["schema_version"] == 1
    assert response.json()["server_name"] == "echo"
    assert response.json()["tasks"][0]["params_schema"]["properties"] == {
        "text": {"title": "Text", "type": "string"}
    }


def test_rest_rejects_unknown_or_coerced_params() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        body, headers = _signed_json(
            {"text": "hello", "unexpected": True}, "00000000-0000-0000-0000-000000000001"
        )
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"


def test_rest_requires_a_valid_raw_body_signature() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        response = client.post(
            "/internal/tasks/echo",
            headers={"X-Taskome-Job-Id": "00000000-0000-0000-0000-000000000006"},
            json={"text": "hello"},
        )

    assert response.status_code == 401


def test_rest_rejects_a_signed_but_non_uuid_job_id() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    body = b'{"text":"hello"}'
    headers = signed_request_headers(method="POST", target="/internal/tasks/echo", body=body)
    headers["X-Taskome-Job-Id"] = "not-a-uuid"
    headers["content-type"] = "application/json"

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 401


def test_rest_rejects_an_oversized_raw_body_before_json_parsing() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(request_body_max_bytes=10),
    )
    body, headers = _signed_json({"text": "too large"}, "00000000-0000-0000-0000-000000000008")

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 413


def test_rest_rejects_a_recently_completed_job_id() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    body, headers = _signed_json({"text": "hello"}, "00000000-0000-0000-0000-000000000007")

    with TestClient(app) as client:
        first = client.post("/internal/tasks/echo", headers=headers, content=body)
        assert first.status_code == 200
        replay = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert replay.status_code == 409
    assert replay.json()["type"] == "urn:taskome:error:duplicate_job"


def test_rest_rejects_unknown_fields_in_nested_params() -> None:
    app = build_task_server(
        name="nested",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a nested message.",
                params_model=NestedParams,
                result_model=EchoResult,
                adapter=NestedAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        body, headers = _signed_json(
            {"payload": {"text": "hello", "unexpected": True}},
            "00000000-0000-0000-0000-000000000002",
        )
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 422


def test_rest_publishes_validated_produced_files_and_cleans_the_workdir(tmp_path: Path) -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="write",
                description="Write a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=OutputAdapter(),
            ),
        ),
        runtime=fake_runtime(workdir_root=tmp_path),
    )

    with TestClient(app) as client:
        body = json.dumps({"text": "hello"}, separators=(",", ":")).encode()
        headers = signed_request_headers(
            method="POST",
            target="/internal/tasks/write",
            body=body,
            job_id=UUID("00000000-0000-0000-0000-000000000003"),
        )
        headers["content-type"] = "application/json"
        response = client.post("/internal/tasks/write", headers=headers, content=body)

    assert response.json()["outputs"] == [
        {
            "name": "result",
            "storage_key": "test/result",
            "media_type": "text/plain",
            "download_name": "result.txt",
            "size_bytes": 5,
            "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        }
    ]
    assert not list(tmp_path.iterdir())


def test_rest_rejects_symlinked_produced_files(tmp_path: Path) -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="write",
                description="Write a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=SymlinkOutputAdapter(),
            ),
        ),
        runtime=fake_runtime(workdir_root=tmp_path),
    )
    body = b'{"text":"hello"}'
    headers = signed_request_headers(
        method="POST",
        target="/internal/tasks/write",
        body=body,
        job_id=UUID("00000000-0000-0000-0000-000000000009"),
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/write", headers=headers, content=body)

    assert response.status_code == 500
    assert response.json()["type"] == "urn:taskome:error:compute_failed"
    assert not list(tmp_path.iterdir())
