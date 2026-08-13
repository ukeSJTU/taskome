from __future__ import annotations

import asyncio
import json
import sys
from typing import TYPE_CHECKING, Any

import httpx2
from fastmcp.server.auth.providers.jwt import JWTVerifier
from fastmcp.utilities.asgi_transport import run_asgi_lifespan
from fastmcp.utilities.tests import ASGIServer
from gateway.api.mcp import create_mcp_server
from gateway.core.auth import MCPPrincipalVerifier, create_mcp_auth_provider
from gateway.core.config import Environment, Settings

if TYPE_CHECKING:
    from uuid import UUID

    from gateway.services.input_files import DownloadUrl, UploadUrl


class UnusedInputFileService:
    async def mint_upload_url(
        self,
        owner_user_id: str,
        original_filename: str,
    ) -> UploadUrl:
        del owner_user_id, original_filename
        raise AssertionError

    async def mint_download_url(
        self,
        owner_user_id: str,
        input_file_id: UUID,
    ) -> DownloadUrl:
        del owner_user_id, input_file_id
        raise AssertionError


async def probe(access_token: str, jwks: dict[str, Any]) -> list[str]:
    async def jwks_handler(_request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=jwks)

    settings = Settings(
        app_environment=Environment.TEST,
        database_url="postgresql+psycopg://test:test@localhost/taskome",
    )
    token_verifier = MCPPrincipalVerifier(
        JWTVerifier(
            jwks_uri="http://auth.test/api/auth/jwks",
            issuer=settings.auth_oauth_issuer,
            audience=settings.mcp_resource,
            algorithm="EdDSA",
            http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(jwks_handler)),
        )
    )
    server = create_mcp_server(
        settings,
        UnusedInputFileService(),
        auth_provider=create_mcp_auth_provider(settings, token_verifier),
    )
    asgi_server = ASGIServer(
        url="http://127.0.0.1/mcp",
        app=server.http_app(path="/mcp"),
        transport_type="streamable-http",
    )
    async with (
        run_asgi_lifespan(asgi_server.app),
        asgi_server.client(auth=access_token) as client,
    ):
        return [tool.name for tool in await client.list_tools()]


request = json.load(sys.stdin)
tools = asyncio.run(probe(request["accessToken"], request["jwks"]))
assert tools == ["prepare_input_file_upload", "prepare_input_file_download"]
json.dump({"tools": tools}, sys.stdout)
