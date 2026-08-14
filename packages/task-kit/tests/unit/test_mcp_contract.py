# ruff: noqa: S101

import json
from typing import Any

from fastapi.testclient import TestClient
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


def _message(response_text: str) -> dict[str, Any]:
    return json.loads(response_text.replace("\r\n", "\n").removeprefix("event: message\ndata: "))


def test_mcp_lists_a_flat_alias_aware_tool_schema() -> None:
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
    initialize = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1"},
        },
    }

    with TestClient(app) as client:
        initialized = client.post("/mcp/", json=initialize)
        listed = client.post(
            "/mcp/",
            headers={"mcp-session-id": initialized.headers["mcp-session-id"]},
            json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
        )

    tool = _message(listed.text)["result"]["tools"][0]
    assert tool["inputSchema"] == {
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
        "type": "object",
        "additionalProperties": False,
    }
