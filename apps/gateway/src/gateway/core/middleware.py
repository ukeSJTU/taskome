"""ASGI middleware for request identity, limits, security, and access logs."""

from __future__ import annotations

import json
import time
from collections import deque
from http import HTTPStatus
from typing import TYPE_CHECKING
from uuid import uuid4

import structlog
from opentelemetry.trace import get_current_span
from starlette.datastructures import Headers

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

_BASE_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


def security_headers(*, include_hsts: bool) -> dict[str, str]:
    """Return the security headers applied uniformly to HTTP responses."""

    headers = dict(_BASE_SECURITY_HEADERS)
    if include_hsts:
        headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return headers


class AccessLoggingMiddleware:
    """Emit one structured access event after every non-health HTTP request."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.logger = structlog.get_logger()

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
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
            log = (
                self.logger.error
                if status_code >= HTTPStatus.INTERNAL_SERVER_ERROR
                else self.logger.warning
                if status_code >= HTTPStatus.BAD_REQUEST
                else self.logger.info
            )
            log(
                "http_request",
                method=scope.get("method", "UNKNOWN"),
                path=getattr(route, "path", scope.get("path", "")),
                status_code=status_code,
                duration_ms=round((time.perf_counter() - started_at) * 1000, 2),
                trace_id=(f"{span_context.trace_id:032x}" if span_context.is_valid else None),
            )


class RequestIDMiddleware:
    """Generate a trusted request id and bind it to response and log context."""

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
    """Append the Gateway security-header baseline to HTTP responses."""

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


class RequestBodyLimitMiddleware:
    """Reject oversized HTTP bodies before FastAPI or MCP parses them.

    The middleware checks both declared and streamed size so callers cannot
    bypass the limit by omitting or lying about ``Content-Length``.

    Args:
        app: Wrapped ASGI application.
        max_body_size: Maximum accepted body size in bytes.
    """

    def __init__(self, app: ASGIApp, *, max_body_size: int) -> None:
        self.app = app
        self.max_body_size = max_body_size

    async def __call__(  # noqa: C901 - streaming validation is one ASGI state machine.
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = Headers(scope=scope).get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > self.max_body_size:
                    await self._reject(send)
                    return
            except ValueError:
                pass

        buffered: deque[Message] = deque()
        total = 0
        while True:
            message = await receive()
            buffered.append(message)
            if message["type"] != "http.request":
                break
            total += len(message.get("body", b""))
            if total > self.max_body_size:
                await self._reject(send)
                return
            if not message.get("more_body", False):
                break

        async def replay() -> Message:
            if buffered:
                return buffered.popleft()
            return await receive()

        await self.app(scope, replay, send)

    @staticmethod
    async def _reject(send: Send) -> None:
        body = b'{"detail":"Request body is too large."}'
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


class MCPAuthRequestIDMiddleware:
    """Add the parent Gateway request id to FastMCP authentication failures."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started: Message | None = None
        body = bytearray()

        async def capture(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = message
                return
            if started is None:
                await send(message)
                return
            if started is not None and started["status"] == HTTPStatus.UNAUTHORIZED:
                body.extend(message.get("body", b""))
                if message.get("more_body", False):
                    return
                request_id = scope.get("state", {}).get("request_id")
                try:
                    content = json.loads(body) if body else {}
                except json.JSONDecodeError:
                    content = {"error": "unauthorized"}
                content["request_id"] = request_id
                headers = [
                    (name, value)
                    for name, value in started.get("headers", [])
                    if name.lower() not in {b"content-length", b"content-type"}
                ]
                response_body = json.dumps(content).encode("utf-8")
                headers.extend(
                    [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(response_body)).encode("ascii")),
                    ]
                )
                await send(
                    {
                        "type": "http.response.start",
                        "status": HTTPStatus.UNAUTHORIZED,
                        "headers": headers,
                    }
                )
                await send({"type": "http.response.body", "body": response_body})
                return
            await send(started)
            started = None
            await send(message)

        await self.app(scope, receive, capture)
