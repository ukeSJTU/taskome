# ruff: noqa: PLR2004, S101

from fastapi.testclient import TestClient
from pydantic import BaseModel
from task_kit import ComputeContext, ComputeResult, TaskDefinition, build_task_server
from task_kit.testing import fake_runtime


class Params(BaseModel):
    message: str


class Result(BaseModel):
    message: str


class Adapter:
    def run(self, params: Params, ctx: ComputeContext) -> ComputeResult[Result]:
        del ctx
        return ComputeResult(value=Result(message=params.message))


def test_liveness_is_process_only_and_readiness_tracks_lifespan() -> None:
    app = build_task_server(
        name="echo",
        tasks=(TaskDefinition("echo", "Echo a message.", Params, Result, Adapter()),),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        assert client.get("/health/live").json() == {"status": "live"}
        assert client.get("/health/ready").status_code == 200

    assert app.state.ready is False


def test_docs_are_disabled_unless_runtime_explicitly_enables_them() -> None:
    task = TaskDefinition("echo", "Echo a message.", Params, Result, Adapter())
    hidden = build_task_server(name="echo", tasks=(task,), runtime=fake_runtime())
    visible = build_task_server(name="echo", tasks=(task,), runtime=fake_runtime(docs_enabled=True))

    with TestClient(hidden) as client:
        assert client.get("/docs").status_code == 404
    with TestClient(visible) as client:
        assert client.get("/docs").status_code == 200
