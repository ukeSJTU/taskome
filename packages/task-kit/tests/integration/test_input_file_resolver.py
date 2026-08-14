# ruff: noqa: A002, ASYNC240, PLR2004, S101, S105, TC003

from __future__ import annotations

import hashlib
import hmac
import json
import time
from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from typing import ClassVar
from uuid import UUID

import httpx
import pytest
from task_kit import InputFileId
from task_kit.runtime import GatewayInputFileResolver

_INPUT_ID = "00000000-0000-0000-0000-000000000004"
_JOB_ID = UUID("00000000-0000-0000-0000-000000000005")
_SECRET = "0123456789abcdef0123456789abcdef"


class FakeGatewayHandler(BaseHTTPRequestHandler):
    base_url = ""
    payload = b"hello"
    declared_size = 5
    resolve_requests: ClassVar[list[dict[str, object]]] = []
    verified_requests = 0

    def do_POST(self) -> None:
        length = int(self.headers["content-length"])
        raw_body = self.rfile.read(length)
        if not self._valid_signature(raw_body):
            self.send_error(401)
            return
        type(self).verified_requests += 1
        body = json.loads(raw_body)
        type(self).resolve_requests.append(body)
        self._send_json(
            {
                "input_files": [
                    {
                        "id": _INPUT_ID,
                        "url": f"{self.base_url}/input",
                        "size_bytes": self.declared_size,
                    }
                ]
            }
        )

    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("content-length", str(len(self.payload)))
        self.end_headers()
        self.wfile.write(self.payload)

    def log_message(self, format: str, *args: object) -> None:
        del format, args

    def _send_json(self, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _valid_signature(self, body: bytes) -> bool:
        timestamp = self.headers.get("x-taskome-timestamp", "")
        job_id = self.headers.get("x-taskome-job-id", "")
        traceparent = self.headers.get("traceparent", "")
        try:
            fresh = abs(time.time() - int(timestamp)) <= 5
        except ValueError:
            return False
        canonical = "\n".join(
            (
                "taskome-v1",
                timestamp,
                "POST",
                self.path,
                job_id,
                traceparent,
                hashlib.sha256(body).hexdigest(),
            )
        )
        expected = hmac.new(_SECRET.encode(), canonical.encode(), hashlib.sha256).hexdigest()
        return (
            fresh
            and job_id == str(_JOB_ID)
            and self.path == f"/internal/jobs/{_JOB_ID}/input-files/resolve"
            and hmac.compare_digest(expected, self.headers.get("x-taskome-signature", ""))
        )


@contextmanager
def fake_gateway(*, payload: bytes, declared_size: int) -> Iterator[str]:
    FakeGatewayHandler.payload = payload
    FakeGatewayHandler.declared_size = declared_size
    FakeGatewayHandler.resolve_requests = []
    FakeGatewayHandler.verified_requests = 0
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeGatewayHandler)
    FakeGatewayHandler.base_url = f"http://127.0.0.1:{server.server_port}"
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield FakeGatewayHandler.base_url
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


@pytest.mark.asyncio
async def test_resolver_streams_exact_gateway_bytes_to_controlled_uuid_paths(
    tmp_path: Path,
) -> None:
    with fake_gateway(payload=b"hello", declared_size=5) as gateway_url:
        async with httpx.AsyncClient() as client:
            resolver = GatewayInputFileResolver(gateway_url, _SECRET, client)
            paths = await resolver.materialize(
                _JOB_ID,
                [InputFileId(_INPUT_ID)],
                tmp_path,
            )

    assert FakeGatewayHandler.resolve_requests == [{"input_file_ids": [_INPUT_ID]}]
    assert FakeGatewayHandler.verified_requests == 1
    assert paths[InputFileId(_INPUT_ID)].read_bytes() == b"hello"
    assert not list(tmp_path.glob("*.part"))


@pytest.mark.parametrize(
    ("payload", "declared_size"),
    [
        (b"hello!", 5),
        (b"hello", 6),
        (b"", 50 * 1024 * 1024 + 1),
    ],
)
@pytest.mark.asyncio
async def test_resolver_rejects_invalid_sizes_and_removes_partial_files(
    tmp_path: Path,
    payload: bytes,
    declared_size: int,
) -> None:
    with fake_gateway(payload=payload, declared_size=declared_size) as gateway_url:
        async with httpx.AsyncClient() as client:
            resolver = GatewayInputFileResolver(gateway_url, _SECRET, client)
            with pytest.raises(RuntimeError):
                await resolver.materialize(
                    _JOB_ID,
                    [InputFileId(_INPUT_ID)],
                    tmp_path,
                )

    assert not list(tmp_path.iterdir())
