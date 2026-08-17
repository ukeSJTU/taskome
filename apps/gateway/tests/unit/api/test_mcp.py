from __future__ import annotations

import asyncio
import base64
import json
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, cast
from uuid import UUID, uuid4

import httpx2
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from fastmcp.exceptions import ToolError
from fastmcp.server.auth.providers.jwt import JWTVerifier, StaticTokenVerifier
from fastmcp.utilities.asgi_transport import run_asgi_lifespan
from fastmcp.utilities.tests import ASGIServer
from gateway.api.mcp import create_mcp_server
from gateway.core.auth import MCPPrincipalVerifier
from gateway.core.config import Environment, Settings
from gateway.schemas.input_files import MAX_INPUT_FILE_BYTES
from gateway.services.input_files import DownloadUrl, InputFileService, UploadUrl
from mcp.shared.exceptions import MCPError

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI
    from fastmcp.tools.base import Tool
    from starlette.types import ASGIApp, Receive, Scope, Send


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _channel_tokens() -> tuple[str, str, str, JWTVerifier]:
    private_key = Ed25519PrivateKey.generate()
    jwks = {
        "keys": [
            {
                "alg": "EdDSA",
                "crv": "Ed25519",
                "kid": "test-key",
                "kty": "OKP",
                "use": "sig",
                "x": _base64url(private_key.public_key().public_bytes_raw()),
            },
        ],
    }

    def sign(*, issuer: str, audience: str, client_id: str | None = None) -> str:
        claims = {
            "aud": audience,
            "exp": datetime.now(UTC) + timedelta(minutes=5),
            "iat": datetime.now(UTC),
            "iss": issuer,
            "sub": "user-123",
        }
        if client_id is not None:
            claims["azp"] = client_id
        return jwt.encode(
            claims,
            private_key,
            algorithm="EdDSA",
            headers={"kid": "test-key"},
        )

    async def jwks_handler(_request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=jwks)

    verifier = JWTVerifier(
        jwks_uri="http://auth.test/api/auth/jwks",
        issuer="http://localhost:3000/api/auth",
        audience="http://localhost:8000/mcp",
        algorithm="EdDSA",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(jwks_handler)),
    )
    oauth_token = sign(
        issuer="http://localhost:3000/api/auth",
        audience="http://localhost:8000/mcp",
        client_id="mcp-client",
    )
    session_token = sign(
        issuer="http://localhost:3000",
        audience="http://localhost:8000/v1",
    )
    rest_oauth_token = sign(
        issuer="http://localhost:3000/api/auth",
        audience="http://localhost:8000/v1",
        client_id="taskome-cli",
    )
    return oauth_token, session_token, rest_oauth_token, verifier


def test_mcp_accepts_oauth_token_and_rejects_session_token_through_protocol(
    create_test_app: Callable[..., FastAPI],
    capsys: pytest.CaptureFixture[str],
) -> None:
    oauth_token, session_token, rest_oauth_token, verifier = _channel_tokens()

    class LifespanStateApp:
        def __init__(self, app: ASGIApp) -> None:
            self.app = app

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] == "lifespan":
                scope["state"] = {}
            await self.app(scope, receive, send)

    async def list_tools(token: str) -> list[Tool]:
        app = create_test_app(
            Settings(app_environment=Environment.TEST),
            mcp_token_verifier=verifier,
        )
        server = ASGIServer(
            url="http://127.0.0.1/mcp",
            app=app,
            transport_type="http",
        )
        async with (
            run_asgi_lifespan(LifespanStateApp(app)),
            server.client(
                headers={"Authorization": f"Bearer {token}"},
            ) as client,
        ):
            return await client.list_tools()

    async def list_tools_with_personal_api_key() -> list[Tool]:
        app = create_test_app(
            Settings(app_environment=Environment.TEST),
            mcp_token_verifier=verifier,
        )
        server = ASGIServer(url="http://127.0.0.1/mcp", app=app, transport_type="http")
        async with (
            run_asgi_lifespan(LifespanStateApp(app)),
            server.client(headers={"X-API-Key": "taskome_direct-secret"}) as client,
        ):
            return await client.list_tools()

    assert [tool.name for tool in asyncio.run(list_tools(oauth_token))] == [
        "prepare_input_file_upload",
        "prepare_input_file_download",
    ]
    with pytest.raises(MCPError):
        asyncio.run(list_tools(session_token))
    with pytest.raises(MCPError):
        asyncio.run(list_tools(rest_oauth_token))
    with pytest.raises(MCPError):
        asyncio.run(list_tools_with_personal_api_key())

    events = [
        json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")
    ]
    access_events = [event for event in events if event["event"] == "http_request"]
    assert any(
        event.get("user_id") == "user-123"
        and event.get("credential_kind") == "oauth_access_token"
        and event.get("credential_id") == "mcp-client"
        for event in access_events
    )
    assert oauth_token not in json.dumps(access_events)
    assert any(event["status_code"] == 401 for event in access_events)


def test_rejected_mcp_auth_includes_request_id_and_is_access_logged(
    create_test_app: Callable[..., FastAPI],
    capsys: pytest.CaptureFixture[str],
) -> None:
    app = create_test_app()

    with TestClient(app) as client:
        response = client.post("/mcp/", json={"jsonrpc": "2.0", "id": 1, "method": "ping"})

    assert response.status_code == 401
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    events = [
        json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")
    ]
    assert any(event["event"] == "http_request" and event["status_code"] == 401 for event in events)


def test_mcp_message_limit_is_independent_from_the_gateway_body_limit(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(Settings(request_body_max_bytes=256, mcp_message_max_bytes=32))

    with TestClient(app) as client:
        response = client.post(
            "/mcp/",
            content=b"x" * 64,
            headers={"Content-Type": "application/json"},
        )

    assert response.status_code == 413


def test_mcp_publishes_protected_resource_metadata(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(Settings(app_environment=Environment.TEST))

    with TestClient(app) as client:
        response = client.get("/.well-known/oauth-protected-resource/mcp")

    assert response.status_code == 200
    assert response.json() == {
        "authorization_servers": ["http://localhost:3000/api/auth"],
        "bearer_methods_supported": ["header"],
        "resource": "http://localhost:8000/mcp",
        "resource_name": "Taskome MCP",
        "scopes_supported": ["taskome"],
    }


def test_rest_publishes_protected_resource_metadata(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(Settings(app_environment=Environment.TEST))

    with TestClient(app) as client:
        response = client.get("/.well-known/oauth-protected-resource/v1")

    assert response.status_code == 200
    assert response.json() == {
        "authorization_servers": ["http://localhost:3000/api/auth"],
        "bearer_methods_supported": ["header"],
        "resource": "http://localhost:8000/v1",
        "resource_name": "Taskome REST API",
        "scopes_supported": ["taskome"],
    }


def test_mcp_upload_tool_delegates_to_the_shared_service() -> None:
    class FakeInputFileService:
        async def mint_upload_url(
            self, owner_user_id: str, original_filename: str, size_bytes: int
        ) -> UploadUrl:
            assert owner_user_id == "user-a"
            assert original_filename == "binder.pdb"
            assert size_bytes == 1024
            return UploadUrl(
                id=uuid4(),
                upload_url="http://seaweedfs/upload",
                expires_at=datetime.now(UTC),
            )

    async def call_tool() -> dict[str, str]:
        server = create_mcp_server(
            Settings(app_environment=Environment.TEST),
            cast("InputFileService", FakeInputFileService()),
            auth_provider=MCPPrincipalVerifier(
                StaticTokenVerifier(
                    {
                        "test-token": {
                            "client_id": "test-client",
                            "scopes": [],
                            "sub": "user-a",
                        }
                    }
                )
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
                {"original_filename": "binder.pdb", "size_bytes": 1024},
            )
            return cast("dict[str, str]", result.structured_content)

    result = asyncio.run(call_tool())
    assert result["upload_url"] == "http://seaweedfs/upload"


@pytest.mark.parametrize(
    "arguments",
    [
        {"original_filename": "binder.pdb", "size_bytes": "1024"},
        {"original_filename": "x" * 256, "size_bytes": 1024},
        {"original_filename": "binder.pdb", "size_bytes": MAX_INPUT_FILE_BYTES + 1},
    ],
)
def test_mcp_upload_tool_rejects_invalid_boundary_values(arguments: dict[str, object]) -> None:
    class FakeInputFileService:
        async def mint_upload_url(self, *_args: object) -> UploadUrl:
            pytest.fail("invalid MCP arguments reached the service")

    async def call_tool() -> None:
        server = create_mcp_server(
            Settings(app_environment=Environment.TEST),
            cast("InputFileService", FakeInputFileService()),
            auth_provider=MCPPrincipalVerifier(
                StaticTokenVerifier(
                    {
                        "test-token": {
                            "client_id": "test-client",
                            "scopes": [],
                            "sub": "user-a",
                        }
                    }
                )
            ),
        )
        asgi_server = ASGIServer(
            url="http://127.0.0.1/mcp",
            app=server.http_app(path="/mcp"),
            transport_type="streamable-http",
        )
        # FastMCP 4 beta currently surfaces strict numeric coercion rejection
        # as a transport IndexError; both paths stop before the service call.
        with pytest.raises((ToolError, IndexError)):
            async with (
                run_asgi_lifespan(asgi_server.app),
                asgi_server.client(auth="test-token") as client,
            ):
                await client.call_tool("prepare_input_file_upload", arguments)

    asyncio.run(call_tool())


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
            auth_provider=MCPPrincipalVerifier(
                StaticTokenVerifier(
                    {
                        "test-token": {
                            "client_id": "test-client",
                            "scopes": [],
                            "sub": "user-a",
                        }
                    }
                )
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
