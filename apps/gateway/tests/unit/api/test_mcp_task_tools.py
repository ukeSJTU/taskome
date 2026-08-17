"""Dynamic per-Task MCP tools (`register_task_tools`), blocking until the Job completes.

See tests/unit/api/test_mcp.py for the always-present, non-Task tools
(`prepare_input_file_upload`/`prepare_input_file_download`) and their auth coverage.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING
from uuid import uuid4

from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
from fastmcp.utilities.asgi_transport import run_asgi_lifespan
from fastmcp.utilities.tests import ASGIServer
from gateway.api.mcp import create_mcp_server, register_task_tools
from gateway.core.auth import MCPPrincipalVerifier
from gateway.core.config import Environment, Settings
from gateway.services.jobs import InvalidJobParamsError, TaskNotFoundError
from gateway.services.task_manifests import TaskManifest
from task_kit import TaskResources

from tests.unit.fakes import FakeInputFileService, FakeJobService

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastmcp import Client

_PARAMS_SCHEMA = {
    "type": "object",
    "properties": {"structure": {"type": "string"}},
    "required": ["structure"],
    "additionalProperties": False,
}
_RESULT_SCHEMA = {
    "type": "object",
    "properties": {"pocket_count": {"type": "integer"}},
    "additionalProperties": False,
}
_MANIFEST = TaskManifest(
    task_server_name="fpocket",
    task_name="detect_pockets",
    description="Detect binding pockets.",
    params_schema=_PARAMS_SCHEMA,
    result_schema=_RESULT_SCHEMA,
    schema_version=1,
    resources=TaskResources(num_cpus=1, num_gpus=0),
    max_duration_seconds=600,
)


@asynccontextmanager
async def _connected_client(job_service: FakeJobService) -> AsyncIterator[Client]:
    server = create_mcp_server(
        Settings(app_environment=Environment.TEST),
        FakeInputFileService(),
        job_service=job_service,
        auth_provider=MCPPrincipalVerifier(
            StaticTokenVerifier(
                {"test-token": {"client_id": "test-client", "scopes": [], "sub": "user-a"}}
            )
        ),
    )
    register_task_tools(server, job_service, {"fpocket": {"detect_pockets": _MANIFEST}})
    asgi_server = ASGIServer(
        url="http://127.0.0.1/mcp",
        app=server.http_app(path="/mcp"),
        transport_type="streamable-http",
    )
    async with (
        run_asgi_lifespan(asgi_server.app),
        asgi_server.client(auth="test-token") as client,
    ):
        yield client


def test_task_tool_is_listed_alongside_the_static_tools() -> None:
    async def list_tools() -> list[str]:
        async with _connected_client(FakeJobService()) as client:
            tools = await client.list_tools()
            return [tool.name for tool in tools]

    names = asyncio.run(list_tools())
    assert "submit_detect_pockets" in names
    assert "prepare_input_file_upload" in names


def test_task_tool_returns_a_queued_job_identifier_immediately() -> None:
    job_service = FakeJobService()

    async def call_tool() -> object:
        async with _connected_client(job_service) as client:
            return await client.call_tool("submit_detect_pockets", {"structure": str(uuid4())})

    result = asyncio.run(call_tool())

    assert result.is_error is False
    assert result.structured_content == {"job_id": str(job_service.job_id), "status": "queued"}
    assert job_service.submitted_for is not None
    owner, server_name, task_name, params = job_service.submitted_for
    assert owner == "user-a"
    assert server_name == "fpocket"
    assert task_name == "detect_pockets"
    assert "structure" in params


def test_task_tool_maps_invalid_params_to_an_mcp_error() -> None:
    job_service = FakeJobService()
    job_service.raise_on_submit = InvalidJobParamsError("min_alpha_size must be positive")

    async def call_tool() -> object:
        async with _connected_client(job_service) as client:
            return await client.call_tool(
                "submit_detect_pockets", {"structure": str(uuid4())}, raise_on_error=False
            )

    result = asyncio.run(call_tool())

    assert result.is_error is True
    assert result.meta["taskome"]["error_code"] == "invalid_input"


def test_task_tool_maps_task_not_found_to_an_mcp_error() -> None:
    job_service = FakeJobService()
    job_service.raise_on_submit = TaskNotFoundError()

    async def call_tool() -> object:
        async with _connected_client(job_service) as client:
            return await client.call_tool(
                "submit_detect_pockets", {"structure": str(uuid4())}, raise_on_error=False
            )

    result = asyncio.run(call_tool())

    assert result.is_error is True
    assert result.meta["taskome"]["error_code"] == "task_not_found"
