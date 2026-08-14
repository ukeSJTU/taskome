# ruff: noqa: PLR2004, S101

from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from task_kit import (
    ComputeContext,
    ComputeResult,
    TaskDefinition,
    build_task_server,
)
from task_kit.testing import fake_runtime


class EchoParams(BaseModel):
    message: str = Field(alias="text")


class EchoResult(BaseModel):
    message: str


class EchoAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=params.message))


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
