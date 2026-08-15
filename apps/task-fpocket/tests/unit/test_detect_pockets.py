"""REST/MCP contract tests for the detect_pockets Task, using the real fpocket binary."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import TYPE_CHECKING
from uuid import UUID

import httpx2
import pytest
from fastapi.testclient import TestClient
from fastmcp import Client
from fastmcp.client import StreamableHttpTransport
from fpocket_server.adapter import DetectPocketsAdapter
from fpocket_server.models import DetectPocketsParams, DetectPocketsValue
from task_kit import InputFileId, TaskDefinition, build_task_server
from task_kit.testing import fake_runtime, signed_request_headers

if TYPE_CHECKING:
    from collections.abc import Collection, Mapping

    from fastapi import FastAPI

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"
_STRUCTURE_1UYD = InputFileId(UUID("00000000-0000-0000-0000-0000000000a1"))
_STRUCTURE_TINY = InputFileId(UUID("00000000-0000-0000-0000-0000000000a2"))
_STRUCTURE_EMPTY = InputFileId(UUID("00000000-0000-0000-0000-0000000000a3"))

_DETECT_POCKETS_TASK = TaskDefinition(
    name="detect_pockets",
    description="Detect binding pockets in a protein structure with fpocket.",
    params_model=DetectPocketsParams,
    result_model=DetectPocketsValue,
    adapter=DetectPocketsAdapter(),
)


class _FixtureInputFiles:
    """An InputFileResolver test double backed by local fixture files."""

    def __init__(self, files: Mapping[InputFileId, Path]) -> None:
        self._files = dict(files)

    async def materialize(
        self, job_id: UUID, input_file_ids: Collection[InputFileId], destination_dir: Path
    ) -> Mapping[InputFileId, Path]:
        del job_id
        resolved: dict[InputFileId, Path] = {}
        for input_file_id in input_file_ids:
            target = destination_dir / str(input_file_id.root)
            shutil.copyfile(self._files[input_file_id], target)
            resolved[input_file_id] = target
        return resolved


def _build_app(tmp_path: Path) -> FastAPI:
    runtime = fake_runtime(workdir_root=tmp_path)
    runtime.input_files = _FixtureInputFiles(
        {
            _STRUCTURE_1UYD: FIXTURES_DIR / "1UYD.pdb",
            _STRUCTURE_TINY: FIXTURES_DIR / "tiny_no_pockets.pdb",
            _STRUCTURE_EMPTY: FIXTURES_DIR / "empty.pdb",
        }
    )
    return build_task_server(name="fpocket", tasks=(_DETECT_POCKETS_TASK,), runtime=runtime)


def _post_detect_pockets(
    app: FastAPI, structure: InputFileId, job_id: str, **params: object
) -> httpx2.Response:
    body = json.dumps({"structure": str(structure.root), **params}, separators=(",", ":")).encode()
    headers = signed_request_headers(
        method="POST",
        target="/internal/tasks/detect_pockets",
        body=body,
        job_id=UUID(job_id),
    )
    headers["content-type"] = "application/json"
    with TestClient(app) as client:
        return client.post("/internal/tasks/detect_pockets", headers=headers, content=body)


def test_detect_pockets_finds_real_pockets_in_a_known_structure(tmp_path: Path) -> None:
    app = _build_app(tmp_path)

    response = _post_detect_pockets(app, _STRUCTURE_1UYD, "00000000-0000-0000-0000-000000000101")

    assert response.status_code == 200
    payload = response.json()
    value = payload["value"]
    assert value["pocket_count"] > 0
    assert len(value["pockets"]) == value["pocket_count"]
    assert [pocket["rank"] for pocket in value["pockets"]] == list(
        range(1, value["pocket_count"] + 1)
    )
    for pocket in value["pockets"]:
        assert isinstance(pocket["score"], float)
        assert 0 <= pocket["druggability_score"] <= 1
        assert pocket["num_alpha_spheres"] > 0
        assert pocket["volume"] > 0
    outputs = payload["outputs"]
    assert len(outputs) == 1
    (output,) = outputs
    assert output["name"] == "annotated_structure"
    assert output["storage_key"] == "test/annotated_structure"
    assert output["media_type"] == "chemical/x-pdb"
    assert output["download_name"] == "structure_out.pdb"
    assert output["size_bytes"] > 0
    assert len(output["sha256"]) == 64


def test_detect_pockets_reports_zero_pockets_for_a_tiny_structure(tmp_path: Path) -> None:
    app = _build_app(tmp_path)

    response = _post_detect_pockets(app, _STRUCTURE_TINY, "00000000-0000-0000-0000-000000000102")

    assert response.status_code == 200
    assert response.json() == {"value": {"pocket_count": 0, "pockets": []}, "outputs": []}


def test_detect_pockets_rejects_an_empty_structure_file(tmp_path: Path) -> None:
    app = _build_app(tmp_path)

    response = _post_detect_pockets(app, _STRUCTURE_EMPTY, "00000000-0000-0000-0000-000000000103")

    assert response.status_code == 422
    assert response.json()["type"] == "urn:taskome:error:invalid_input"


def test_detect_pockets_rejects_an_inverted_alpha_size_range(tmp_path: Path) -> None:
    app = _build_app(tmp_path)

    response = _post_detect_pockets(
        app,
        _STRUCTURE_TINY,
        "00000000-0000-0000-0000-000000000104",
        min_alpha_size=6.2,
        max_alpha_size=3.4,
    )

    assert response.status_code == 422


def _mcp_transport(app: FastAPI, *, job_id: UUID) -> StreamableHttpTransport:
    async def sign_tool_call(request: httpx2.Request) -> None:
        try:
            method = json.loads(request.content).get("method")
        except json.JSONDecodeError, UnicodeDecodeError:
            return
        if method != "tools/call":
            return
        request.headers.update(
            signed_request_headers(
                method=request.method,
                target=request.url.raw_path.decode(),
                body=request.content,
                job_id=job_id,
            )
        )

    def client_factory(
        headers: dict[str, str] | None = None,
        timeout: httpx2.Timeout | None = None,
        auth: httpx2.Auth | None = None,
        follow_redirects: bool = True,  # noqa: FBT001, FBT002
    ) -> httpx2.AsyncClient:
        return httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app),
            base_url="http://task-server",
            headers=headers,
            timeout=timeout,
            auth=auth,
            follow_redirects=follow_redirects,
            event_hooks={"request": [sign_tool_call]},
        )

    return StreamableHttpTransport("http://task-server/mcp/", httpx_client_factory=client_factory)


@pytest.mark.asyncio
async def test_mcp_detect_pockets_succeeds_over_a_real_client(tmp_path: Path) -> None:
    app = _build_app(tmp_path)
    job_id = UUID("00000000-0000-0000-0000-000000000105")
    transport = _mcp_transport(app, job_id=job_id)

    async with app.router.lifespan_context(app), Client(transport) as client:
        result = await client.call_tool("detect_pockets", {"structure": str(_STRUCTURE_TINY.root)})

    assert result.is_error is False
    assert result.structured_content == {
        "value": {"pocket_count": 0, "pockets": []},
        "outputs": [],
    }
