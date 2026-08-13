from __future__ import annotations

import time
from typing import TYPE_CHECKING
from uuid import uuid4

import structlog
from fastapi.responses import JSONResponse
from opentelemetry.trace import get_current_span

if TYPE_CHECKING:
    from fastmcp.server.auth import TokenVerifier
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

_BASE_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


def security_headers(*, include_hsts: bool) -> dict[str, str]:
    headers = dict(_BASE_SECURITY_HEADERS)
    if include_hsts:
        headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return headers


class AccessLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.logger = structlog.get_logger()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") in {
            "/health/live",
            "/health/ready",
        }:
            await self.app(scope, receive, send)
            return

        started_at = time.perf_counter()
        status_code = 500

        async def capture_status(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, capture_status)
        finally:
            route = scope.get("route")
            span_context = get_current_span().get_span_context()
            self.logger.info(
                "http_request",
                method=scope.get("method", "UNKNOWN"),
                path=getattr(route, "path", scope.get("path", "")),
                status_code=status_code,
                duration_ms=round((time.perf_counter() - started_at) * 1000, 2),
                trace_id=(f"{span_context.trace_id:032x}" if span_context.is_valid else None),
            )


class RequestIDMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return

        request_id = str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        structlog.contextvars.clear_contextvars()
        tokens = structlog.contextvars.bind_contextvars(request_id=request_id)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode("ascii")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            structlog.contextvars.reset_contextvars(**tokens)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, include_hsts: bool = False) -> None:
        self.app = app
        self.headers = [
            (name.lower().encode("ascii"), value.encode("ascii"))
            for name, value in security_headers(include_hsts=include_hsts).items()
        ]

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(self.headers)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_security_headers)


def _extract_bearer_token(authorization: str) -> str | None:
    if not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return token or None


class MCPAuthenticationMiddleware:
    def __init__(self, app: ASGIApp, *, verifier: TokenVerifier) -> None:
        self.app = app
        self.verifier = verifier

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope.get("path", "").startswith("/mcp"):
            await self.app(scope, receive, send)
            return

        authorization = dict(scope.get("headers", [])).get(b"authorization", b"").decode("latin-1")
        token = _extract_bearer_token(authorization)
        access_token = await self.verifier.verify_token(token) if token else None
        if access_token is None:
            response = JSONResponse(
                {"detail": "A valid bearer token is required."},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
            await response(scope, receive, send)
            return

        scope.setdefault("state", {})["auth"] = access_token.claims
        await self.app(scope, receive, send)
