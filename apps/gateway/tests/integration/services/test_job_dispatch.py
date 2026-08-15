"""Gateway <-> Task Server dispatch and Input File resolution, end to end.

Proves the *protocol* `TaskDispatcher` and `POST /internal/jobs/{id}/input-files/resolve`
speak is real -- both sides run task-kit's own public building blocks
(`GatewayHMACVerifier`, `GatewayInputFileResolver`, `build_task_server`) against a
trivial in-test Task, connected purely in-process via `httpx.ASGITransport`. No real
network port, and deliberately no dependency on `fpocket_server` or the compiled
`fpocket` binary -- that stays a manual/E2E concern (see `scripts/sign-internal-request.py`).

Repository SQL and S3 semantics are covered elsewhere (see those test files' own
docstrings); this file is about the seam *between* Gateway and a Task Server.
"""

from __future__ import annotations

import asyncio
import urllib.request
from typing import TYPE_CHECKING, cast

import httpx
import pytest
from fastmcp.utilities.asgi_transport import run_asgi_lifespan
from gateway.core.config import Environment, Settings
from gateway.db.database import Database
from gateway.main import create_app
from gateway.models.jobs import JobStatus
from gateway.services.task_dispatch import TaskDispatcher
from gateway.services.task_manifests import TaskManifest
from pydantic import BaseModel
from task_kit import (
    ComputeContext,
    ComputeExecutionError,
    ComputeResult,
    InputFileId,
    TaskDefinition,
    build_task_server,
)
from task_kit.runtime import GatewayHMACVerifier, GatewayInputFileResolver, TaskServerRuntime

if TYPE_CHECKING:
    from collections.abc import Collection
    from pathlib import Path
    from uuid import UUID

    from fastapi import FastAPI
    from gateway.services.storage import SeaweedFSStorage
    from redis.asyncio import Redis
    from starlette.types import ASGIApp, Receive, Scope, Send
    from task_kit.runtime import PublishedOutput, ValidatedProducedFile

_SECRET = "dispatch-integration-test-shared-secret-32b"  # noqa: S105
_GATEWAY_URL = "http://gateway.test"
_STRUCTURE_CONTENT = b"ATOM 1 TEST STRUCTURE"


class _LifespanStateApp:
    """Supplies the `state` key some nested-lifespan merging expects (see test_mcp.py)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "lifespan":
            scope["state"] = {}
        await self.app(scope, receive, send)


class _FakeRedis:
    """Stands in for the Redis client `lifespan` pings on every startup, in every
    environment -- Gateway's queue intake isn't built yet (ADR-0004), so this test
    has no real broker to point at and doesn't need one."""

    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        pass


class _UnclosableStorage:
    """Delegates to the module-scoped `storage` fixture, but ignores `close()`.

    Gateway's own lifespan closes whatever storage instance it's given at shutdown --
    reusing the shared fixture directly would break it for every later test in this
    module, the same trap the `postgres_url`-per-test `Database` above avoids.
    """

    def __init__(self, storage: SeaweedFSStorage) -> None:
        self._storage = storage

    def ensure_bucket(self) -> None:
        self._storage.ensure_bucket()

    def mint_upload_url(self, key: str, expires_in: int, size_bytes: int) -> tuple[str, object]:
        return self._storage.mint_upload_url(key, expires_in, size_bytes)

    def mint_download_url(self, key: str, expires_in: int) -> tuple[str, object]:
        return self._storage.mint_download_url(key, expires_in)

    def delete(self, key: str) -> None:
        self._storage.delete(key)

    def start(self) -> None:
        pass

    def close(self) -> None:
        pass


class _DetectPocketsParams(BaseModel):
    structure: InputFileId


class _DetectPocketsValue(BaseModel):
    pocket_count: int
    materialized_bytes: int


class _ReadMaterializedFileAdapter:
    def run(
        self, params: _DetectPocketsParams, ctx: ComputeContext
    ) -> ComputeResult[_DetectPocketsValue]:
        content = ctx.input_path(params.structure).read_bytes()
        return ComputeResult(
            value=_DetectPocketsValue(pocket_count=1, materialized_bytes=len(content))
        )


_SYNTHETIC_FAILURE = "synthetic adapter failure"


class _FailingAdapter:
    def run(
        self, params: _DetectPocketsParams, ctx: ComputeContext
    ) -> ComputeResult[_DetectPocketsValue]:
        del params, ctx
        raise ComputeExecutionError(_SYNTHETIC_FAILURE)


class _NoOutputs:
    async def publish(
        self, server_name: str, job_id: UUID, files: Collection[ValidatedProducedFile]
    ) -> tuple[PublishedOutput, ...]:
        del server_name, job_id, files
        return ()


def _manifest() -> TaskManifest:
    return TaskManifest(
        task_server_name="fpocket",
        task_name="detect_pockets",
        description="Detect binding pockets.",
        params_schema=_DetectPocketsParams.model_json_schema(),
        result_schema=_DetectPocketsValue.model_json_schema(),
        schema_version=1,
    )


def _fake_task_server(*, adapter: object, gateway_app: FastAPI, workdir_root: Path) -> FastAPI:
    gateway_client = httpx.AsyncClient(
        mounts={_GATEWAY_URL: httpx.ASGITransport(app=gateway_app)},
    )
    runtime = TaskServerRuntime(
        gateway_requests=GatewayHMACVerifier(_SECRET, 300),
        input_files=GatewayInputFileResolver(_GATEWAY_URL, _SECRET, gateway_client),
        outputs=_NoOutputs(),
        workdir_root=workdir_root,
    )
    return build_task_server(
        name="fpocket",
        tasks=(
            TaskDefinition(
                name="detect_pockets",
                description="Detect binding pockets.",
                params_model=_DetectPocketsParams,
                result_model=_DetectPocketsValue,
                adapter=adapter,
            ),
        ),
        runtime=runtime,
    )


def _gateway_app(*, postgres_url: str, storage: SeaweedFSStorage) -> FastAPI:
    # A dedicated `Database` per test, not the shared session-scoped fixture: Gateway's
    # own lifespan disposes whatever `Database` it owns at shutdown, which would break
    # later tests if it disposed the fixture shared across this module.
    settings = Settings(
        app_environment=Environment.TEST,
        fpocket_task_hmac_secret=_SECRET,
    )
    app = create_app(
        settings,
        database=Database(postgres_url),
        storage=_UnclosableStorage(storage),
        redis=cast("Redis", _FakeRedis()),
    )
    app.state.job_service.attach_manifests({"fpocket": {"detect_pockets": _manifest()}})
    return app


async def _upload_structure(gateway_app: FastAPI) -> UUID:
    uploaded = await gateway_app.state.owned_input_file_service.mint_upload_url(
        "user-a", "structure.pdb", len(_STRUCTURE_CONTENT)
    )
    put = urllib.request.Request(  # noqa: S310
        uploaded.upload_url,
        data=_STRUCTURE_CONTENT,
        headers={"If-None-Match": "*"},
        method="PUT",
    )
    with await asyncio.to_thread(urllib.request.urlopen, put) as response:
        assert response.status == 200
    return uploaded.id


def _connect_dispatcher(gateway_app: FastAPI, fake_task_server: FastAPI) -> None:
    """Wire the already-built Gateway app to dispatch to the already-built fake Task
    Server -- necessarily a second step, since each app's own construction needs to
    reference the other's already-built ASGI app (see `JobService.attach_dispatcher`)."""

    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=fake_task_server))
    gateway_app.state.job_service.attach_dispatcher(
        TaskDispatcher(gateway_app.state.settings.task_servers, client)
    )


async def test_a_real_job_dispatches_materializes_and_completes(
    postgres_url: str, storage: SeaweedFSStorage, tmp_path: Path
) -> None:
    gateway_app = _gateway_app(postgres_url=postgres_url, storage=storage)
    fake_task_server = _fake_task_server(
        adapter=_ReadMaterializedFileAdapter(), gateway_app=gateway_app, workdir_root=tmp_path
    )

    async with (
        run_asgi_lifespan(_LifespanStateApp(gateway_app)),
        fake_task_server.router.lifespan_context(fake_task_server),
    ):
        _connect_dispatcher(gateway_app, fake_task_server)
        structure_id = await _upload_structure(gateway_app)

        record = await gateway_app.state.job_service.submit_job_and_wait(
            "user-a", "fpocket", "detect_pockets", {"structure": str(structure_id)}
        )

    assert record.status is JobStatus.COMPLETED
    assert record.result == {
        "value": {"pocket_count": 1, "materialized_bytes": len(_STRUCTURE_CONTENT)},
        "outputs": [],
    }


async def test_a_compute_failure_marks_the_job_failed(
    postgres_url: str, storage: SeaweedFSStorage, tmp_path: Path
) -> None:
    gateway_app = _gateway_app(postgres_url=postgres_url, storage=storage)
    fake_task_server = _fake_task_server(
        adapter=_FailingAdapter(), gateway_app=gateway_app, workdir_root=tmp_path
    )

    async with (
        run_asgi_lifespan(_LifespanStateApp(gateway_app)),
        fake_task_server.router.lifespan_context(fake_task_server),
    ):
        _connect_dispatcher(gateway_app, fake_task_server)
        structure_id = await _upload_structure(gateway_app)

        record = await gateway_app.state.job_service.submit_job_and_wait(
            "user-a", "fpocket", "detect_pockets", {"structure": str(structure_id)}
        )

    assert record.status is JobStatus.FAILED
    assert record.error_detail is not None
    assert record.error_detail["error_type"] == "compute_failed"


async def test_job_input_file_ownership_is_enforced_before_dispatch(
    postgres_url: str, storage: SeaweedFSStorage, tmp_path: Path
) -> None:
    gateway_app = _gateway_app(postgres_url=postgres_url, storage=storage)
    fake_task_server = _fake_task_server(
        adapter=_ReadMaterializedFileAdapter(), gateway_app=gateway_app, workdir_root=tmp_path
    )

    async with (
        run_asgi_lifespan(_LifespanStateApp(gateway_app)),
        fake_task_server.router.lifespan_context(fake_task_server),
    ):
        _connect_dispatcher(gateway_app, fake_task_server)
        structure_id = await _upload_structure(gateway_app)

        with pytest.raises(Exception, match="not available"):
            await gateway_app.state.job_service.submit_job_and_wait(
                "user-b", "fpocket", "detect_pockets", {"structure": str(structure_id)}
            )
