"""Pure ASGI raw-body limits and Gateway signature enforcement."""
# ruff: noqa: TC002

from __future__ import annotations

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .runtime import SignedGatewayRequest, TaskServerRuntime


class TaskServerBoundaryMiddleware:
    """Bound and replay raw transport bytes without BaseHTTPMiddleware buffering."""

    def __init__(self, app: ASGIApp, runtime: TaskServerRuntime) -> None:
        self.app = app
        self.runtime = runtime

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope["path"]
        limit = (
            self.runtime.mcp_message_max_bytes
            if path.startswith("/mcp")
            else self.runtime.request_body_max_bytes
        )
        body = await self._read_body(receive, limit)
        if body is None:
            await self._response(
                send,
                413,
                "body_too_large",
                "Request body is too large.",
            )
            return
        headers = {key.decode().lower(): value.decode() for key, value in scope["headers"]}
        target = path + (f"?{scope['query_string'].decode()}" if scope["query_string"] else "")
        if self._requires_signature(path, body):
            request = SignedGatewayRequest(
                timestamp=headers.get("x-taskome-timestamp"),
                signature=headers.get("x-taskome-signature"),
                method=scope["method"],
                target=target,
                body=body,
                job_id=headers.get("x-taskome-job-id"),
                traceparent=headers.get("traceparent"),
            )
            try:
                verified = self.runtime.gateway_requests.verify(request)
                if path != "/internal/manifest" and verified.job_id is None:
                    await self._response(send, 401, "unauthorized", "Invalid Gateway request.")
                    return
                scope.setdefault("state", {})["taskome_gateway_request"] = verified
            except TypeError, ValueError:
                await self._response(send, 401, "unauthorized", "Invalid Gateway request.")
                return
        delivered = False

        async def replay() -> Message:
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, replay, send)

    @staticmethod
    async def _read_body(receive: Receive, limit: int) -> bytes | None:
        chunks = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return None
            chunks.extend(message.get("body", b""))
            if len(chunks) > limit:
                return None
            if not message.get("more_body", False):
                return bytes(chunks)

    @staticmethod
    def _requires_signature(path: str, body: bytes) -> bool:
        if path.startswith("/internal/tasks/") or path == "/internal/manifest":
            return True
        if not path.startswith("/mcp"):
            return False
        try:
            return json.loads(body).get("method") == "tools/call"
        except json.JSONDecodeError, UnicodeDecodeError:
            return False

    @staticmethod
    async def _response(send: Send, status: int, code: str, detail: str) -> None:
        body = json.dumps(
            {
                "type": f"urn:taskome:error:{code}",
                "title": code.replace("_", " "),
                "status": status,
                "detail": detail,
            },
            separators=(",", ":"),
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [(b"content-type", b"application/problem+json")],
            }
        )
        await send({"type": "http.response.body", "body": body})
