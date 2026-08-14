# ruff: noqa: PLR2004, S101

from pathlib import Path

from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from task_kit import (
    ComputeContext,
    ComputeResult,
    ProducedFile,
    TaskDefinition,
    build_task_server,
)
from task_kit.testing import fake_runtime


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
        response = client.post(
            "/internal/tasks/echo",
            headers={"X-Taskome-Job-Id": "00000000-0000-0000-0000-000000000001"},
            json={"text": "hello"},
        )

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
        response = client.get("/internal/manifest")

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
        response = client.post(
            "/internal/tasks/echo",
            headers={"X-Taskome-Job-Id": "00000000-0000-0000-0000-000000000001"},
            json={"text": "hello", "unexpected": True},
        )

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"


def test_rest_rejects_unknown_fields_in_nested_params() -> None:
    app = build_task_server(
        name="nested",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a nested message.",
                params_model=NestedParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        response = client.post(
            "/internal/tasks/echo",
            headers={"X-Taskome-Job-Id": "00000000-0000-0000-0000-000000000002"},
            json={"payload": {"text": "hello", "unexpected": True}},
        )

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
        response = client.post(
            "/internal/tasks/write",
            headers={"X-Taskome-Job-Id": "00000000-0000-0000-0000-000000000003"},
            json={"text": "hello"},
        )

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
