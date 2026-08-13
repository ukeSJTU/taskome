from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import TYPE_CHECKING, cast
from uuid import UUID, uuid4

from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
from fastmcp.utilities.asgi_transport import run_asgi_lifespan
from fastmcp.utilities.tests import ASGIServer
from gateway.api.mcp import create_mcp_server
from gateway.core.config import Environment, Settings
from gateway.services.input_files import DownloadUrl, InputFileService, UploadUrl

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI
    from fastmcp.tools.base import Tool
    from starlette.types import ASGIApp, Receive, Scope, Send


def test_mcp_endpoint_accepts_protocol_clients(create_test_app: Callable[..., FastAPI]) -> None:
    class LifespanStateApp:
        def __init__(self, app: ASGIApp) -> None:
            self.app = app

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] == "lifespan":
                scope["state"] = {}
            await self.app(scope, receive, send)

    async def list_tools() -> list[Tool]:
        app = create_test_app(
            Settings(app_environment=Environment.TEST),
            token_verifier=StaticTokenVerifier(
                {
                    "test-token": {
                        "client_id": "test-client",
                        "scopes": [],
                        "sub": "user-123",
                    }
                }
            ),
        )
        server = ASGIServer(
            url="http://127.0.0.1/mcp",
            app=app,
            transport_type="http",
        )
        async with (
            run_asgi_lifespan(LifespanStateApp(app)),
            server.client(
                headers={"Authorization": "Bearer test-token"},
            ) as client,
        ):
            return await client.list_tools()

    assert [tool.name for tool in asyncio.run(list_tools())] == [
        "prepare_input_file_upload",
        "prepare_input_file_download",
    ]


def test_mcp_upload_tool_delegates_to_the_shared_service() -> None:
    class FakeInputFileService:
        async def mint_upload_url(self, owner_user_id: str, original_filename: str) -> UploadUrl:
            assert owner_user_id == "user-a"
            assert original_filename == "binder.pdb"
            return UploadUrl(
                id=uuid4(),
                upload_url="http://seaweedfs/upload",
                expires_at=datetime.now(UTC),
            )

    async def call_tool() -> dict[str, str]:
        server = create_mcp_server(
            Settings(app_environment=Environment.TEST),
            cast("InputFileService", FakeInputFileService()),
            auth_provider=StaticTokenVerifier(
                {
                    "test-token": {
                        "client_id": "test-client",
                        "scopes": [],
                        "sub": "user-a",
                    }
                }
            ),
        )
        asgi_server = ASGIServer(
            url="http://127.0.0.1/mcp",
            app=server.http_app(path="/mcp"),
            transport_type="streamable-http",
        )
        async with (
            run_asgi_lifespan(asgi_server.app),
            asgi_server.client(auth="test-token") as client,
        ):
            result = await client.call_tool(
                "prepare_input_file_upload",
                {"original_filename": "binder.pdb"},
            )
            return cast("dict[str, str]", result.structured_content)

    result = asyncio.run(call_tool())
    assert result["upload_url"] == "http://seaweedfs/upload"


def test_mcp_download_tool_delegates_to_the_shared_service() -> None:
    input_file_id = uuid4()

    class FakeInputFileService:
        async def mint_download_url(
            self,
            owner_user_id: str,
            requested_input_file_id: UUID,
        ) -> DownloadUrl:
            assert owner_user_id == "user-a"
            assert requested_input_file_id == input_file_id
            return DownloadUrl(
                download_url="http://seaweedfs/download",
                expires_at=datetime.now(UTC),
            )

    async def call_tool() -> dict[str, str]:
        server = create_mcp_server(
            Settings(app_environment=Environment.TEST),
            cast("InputFileService", FakeInputFileService()),
            auth_provider=StaticTokenVerifier(
                {
                    "test-token": {
                        "client_id": "test-client",
                        "scopes": [],
                        "sub": "user-a",
                    }
                }
            ),
        )
        asgi_server = ASGIServer(
            url="http://127.0.0.1/mcp",
            app=server.http_app(path="/mcp"),
            transport_type="streamable-http",
        )
        async with (
            run_asgi_lifespan(asgi_server.app),
            asgi_server.client(auth="test-token") as client,
        ):
            result = await client.call_tool(
                "prepare_input_file_download",
                {"input_file_id": str(input_file_id)},
            )
            return cast("dict[str, str]", result.structured_content)

    result = asyncio.run(call_tool())
    assert result["download_url"] == "http://seaweedfs/download"
