# ruff: noqa: S101

from typing import Any

import httpx2
import pytest
from fastmcp import Client
from fastmcp.client import StreamableHttpTransport
from pydantic import BaseModel, Field
from task_kit import ComputeContext, ComputeResult, TaskDefinition, build_task_server
from task_kit.testing import fake_runtime


class EchoParams(BaseModel):
    message: str = Field(alias="text")


class EchoResult(BaseModel):
    message: str


class EchoAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=params.message))


@pytest.mark.asyncio
async def test_mcp_lists_a_flat_alias_aware_tool_schema_with_a_real_client() -> None:
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

    def client_factory(**kwargs: Any) -> httpx2.AsyncClient:  # noqa: ANN401
        return httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app), base_url="http://task-server", **kwargs
        )

    transport = StreamableHttpTransport(
        "http://task-server/mcp/", httpx_client_factory=client_factory
    )
    async with app.router.lifespan_context(app), Client(transport) as client:
        tools = await client.list_tools()

    assert tools[0].input_schema == {
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
        "type": "object",
        "additionalProperties": False,
    }
