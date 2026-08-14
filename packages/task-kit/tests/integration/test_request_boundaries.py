# ruff: noqa: PLR2004, S101

from typing import TYPE_CHECKING

import httpx
import pytest
from pydantic import BaseModel
from task_kit import ComputeContext, ComputeResult, TaskDefinition, build_task_server
from task_kit.testing import fake_runtime

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


class Params(BaseModel):
    message: str


class Result(BaseModel):
    message: str


class Adapter:
    def run(self, params: Params, ctx: ComputeContext) -> ComputeResult[Result]:
        del ctx
        return ComputeResult(value=Result(message=params.message))


@pytest.mark.parametrize("path", ["/internal/tasks/echo", "/mcp/"])
@pytest.mark.asyncio
async def test_streamed_request_stops_reading_immediately_after_its_budget(path: str) -> None:
    yielded: list[bytes] = []

    async def chunks() -> AsyncIterator[bytes]:
        for chunk in (b"123", b"456", b"unread"):
            yielded.append(chunk)
            yield chunk

    app = build_task_server(
        name="echo",
        tasks=(TaskDefinition("echo", "Echo a message.", Params, Result, Adapter()),),
        runtime=fake_runtime(request_body_max_bytes=5, mcp_message_max_bytes=5),
    )
    transport = httpx.ASGITransport(app=app)

    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(
            transport=transport,
            base_url="http://task-server",
        ) as client,
    ):
        response = await client.post(path, content=chunks())

    assert yielded == [b"123", b"456"]
    assert response.status_code == 413
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json() == {
        "type": "urn:taskome:error:body_too_large",
        "title": "body too large",
        "status": 413,
        "detail": "Request body is too large.",
    }
