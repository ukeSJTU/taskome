# ruff: noqa: EM101, S101, TRY003

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from uuid import UUID

import httpx2
import pytest
from fastmcp import Client
from fastmcp.client import StreamableHttpTransport
from mcp.shared.exceptions import MCPError
from mcp_types import INVALID_PARAMS
from pydantic import BaseModel, Field, model_validator
from task_kit import (
    ComputeContext,
    ComputeExecutionError,
    ComputeResult,
    TaskDefinition,
    build_task_server,
)
from task_kit.testing import fake_runtime, signed_request_headers

if TYPE_CHECKING:
    from fastapi import FastAPI


class EchoParams(BaseModel):
    message: str = Field(alias="text")


class EchoResult(BaseModel):
    message: str


class OrderedParams(BaseModel):
    first: int
    second: int

    @model_validator(mode="after")
    def require_ascending_order(self) -> OrderedParams:
        if self.first >= self.second:
            raise ValueError("first must be less than second")
        return self


class EchoAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=params.message))


class OrderedAdapter:
    def run(self, params: OrderedParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=f"{params.first}:{params.second}"))


class FailingAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del params, ctx
        raise ComputeExecutionError("internal compute diagnostic")


def _transport(app: FastAPI, *, job_id: UUID | None = None) -> StreamableHttpTransport:
    async def sign_tool_call(request: httpx2.Request) -> None:
        if job_id is None:
            return
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

    transport = _transport(app)
    async with app.router.lifespan_context(app), Client(transport) as client:
        tools = await client.list_tools()

    assert tools[0].input_schema == {
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
        "type": "object",
        "additionalProperties": False,
    }
    assert tools[0].output_schema == {
        "type": "object",
        "required": ["value", "outputs"],
        "properties": {
            "value": {
                "properties": {"message": {"title": "Message", "type": "string"}},
                "required": ["message"],
                "title": "EchoResult",
                "type": "object",
                "additionalProperties": False,
            },
            "outputs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": [
                        "name",
                        "storage_key",
                        "media_type",
                        "download_name",
                        "size_bytes",
                        "sha256",
                    ],
                    "properties": {
                        "name": {"type": "string"},
                        "storage_key": {"type": "string"},
                        "media_type": {"type": "string"},
                        "download_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                        "size_bytes": {"type": "integer", "minimum": 0},
                        "sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
                    },
                    "additionalProperties": False,
                },
            },
        },
        "additionalProperties": False,
    }


@pytest.mark.asyncio
async def test_mcp_surfaces_model_validation_as_invalid_params() -> None:
    app = build_task_server(
        name="ordered",
        tasks=(
            TaskDefinition(
                name="order",
                description="Require ascending numbers.",
                params_model=OrderedParams,
                result_model=EchoResult,
                adapter=OrderedAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    transport = _transport(
        app,
        job_id=UUID("00000000-0000-0000-0000-000000000018"),
    )

    async with app.router.lifespan_context(app), Client(transport) as client:
        with pytest.raises(MCPError) as captured:
            await client.call_tool("order", {"first": 2, "second": 1})

    assert captured.value.error.code == INVALID_PARAMS


@pytest.mark.asyncio
async def test_mcp_success_has_structured_and_matching_text_content() -> None:
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
    transport = _transport(
        app,
        job_id=UUID("00000000-0000-0000-0000-000000000023"),
    )

    async with app.router.lifespan_context(app), Client(transport) as client:
        result = await client.call_tool("echo", {"text": "hello"})

    expected = {"value": {"message": "hello"}, "outputs": []}
    assert result.is_error is False
    assert result.structured_content == expected
    assert json.loads(result.content[0].text) == expected


@pytest.mark.asyncio
async def test_mcp_compute_failure_has_stable_internal_error_metadata() -> None:
    app = build_task_server(
        name="failure",
        tasks=(
            TaskDefinition(
                name="fail",
                description="Fail safely.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=FailingAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    transport = _transport(
        app,
        job_id=UUID("00000000-0000-0000-0000-000000000024"),
    )

    async with app.router.lifespan_context(app), Client(transport) as client:
        result = await client.call_tool(
            "fail",
            {"text": "sensitive-sequence-canary"},
            raise_on_error=False,
        )

    assert result.is_error is True
    assert result.structured_content is None
    assert result.meta["taskome"]["error_code"] == "compute_failed"
    assert result.content[0].text == "Task execution failed."
