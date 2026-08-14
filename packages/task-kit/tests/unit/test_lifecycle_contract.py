# ruff: noqa: PLR2004, S101

from typing import TYPE_CHECKING

import pytest
import task_kit.runtime as runtime_api
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError
from task_kit import ComputeContext, ComputeResult, TaskDefinition, build_task_server
from task_kit.testing import TEST_GATEWAY_HMAC_SECRET, fake_runtime

if TYPE_CHECKING:
    from pathlib import Path


class Params(BaseModel):
    message: str


class Result(BaseModel):
    message: str


class Adapter:
    def run(self, params: Params, ctx: ComputeContext) -> ComputeResult[Result]:
        del ctx
        return ComputeResult(value=Result(message=params.message))


def test_runtime_module_exposes_the_supported_production_surface() -> None:
    assert runtime_api.TaskServerSettings
    assert callable(runtime_api.build_runtime)


def test_settings_reject_empty_storage_identity() -> None:
    with pytest.raises(ValidationError):
        runtime_api.TaskServerSettings(
            gateway_internal_url="https://gateway.test",
            gateway_task_hmac_secret=TEST_GATEWAY_HMAC_SECRET,
            seaweedfs_internal_endpoint="https://seaweedfs.test",
            seaweedfs_access_key="",
            seaweedfs_secret_key="",
            seaweedfs_bucket="",
        )


def test_lifespan_rejects_a_missing_workdir_root(tmp_path: Path) -> None:
    runtime = fake_runtime(workdir_root=tmp_path / "missing")
    app = build_task_server(
        name="echo",
        tasks=(TaskDefinition("echo", "Echo a message.", Params, Result, Adapter()),),
        runtime=runtime,
    )

    with pytest.raises(ExceptionGroup) as captured, TestClient(app):
        pass

    assert "workdir_root" in repr(captured.value)


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
