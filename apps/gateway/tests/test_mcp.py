from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, cast

from fastmcp.utilities.asgi_transport import run_asgi_lifespan
from fastmcp.utilities.tests import ASGIServer
from gateway.core.config import Environment, Settings
from gateway.main import create_app

if TYPE_CHECKING:
    from gateway.core.auth import JWKSVerifier
    from starlette.types import ASGIApp, Receive, Scope, Send


def test_mcp_endpoint_accepts_protocol_clients() -> None:
    class TestVerifier:
        async def verify_bearer(self, authorization: str | None) -> dict[str, str]:
            assert authorization == "Bearer test-token"
            return {"sub": "user-123"}

    class LifespanStateApp:
        def __init__(self, app: ASGIApp) -> None:
            self.app = app

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] == "lifespan":
                scope["state"] = {}
            await self.app(scope, receive, send)

    async def list_tools() -> list[object]:
        app = create_app(
            Settings(environment=Environment.TEST),
            auth_verifier=cast("JWKSVerifier", TestVerifier()),
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

    assert asyncio.run(list_tools()) == []
