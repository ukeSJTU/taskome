# ruff: noqa: ASYNC240, S101, TC003

from pathlib import Path
from uuid import UUID

import httpx
import pytest
from task_kit import InputFileId
from task_kit.production import GatewayInputFileResolver


@pytest.mark.asyncio
async def test_resolver_streams_exact_gateway_bytes_to_controlled_uuid_paths(
    tmp_path: Path,
) -> None:
    input_id = "00000000-0000-0000-0000-000000000004"

    def fake_gateway(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/resolve"):
            assert request.headers["X-Taskome-Job-Id"] == "00000000-0000-0000-0000-000000000005"
            assert request.headers["X-Taskome-Signature"]
            return httpx.Response(
                200,
                json={
                    "input_files": [
                        {"id": input_id, "url": "https://files.test/input", "size_bytes": 5}
                    ]
                },
            )
        assert request.url == "https://files.test/input"
        return httpx.Response(200, content=b"hello")

    async with httpx.AsyncClient(transport=httpx.MockTransport(fake_gateway)) as client:
        resolver = GatewayInputFileResolver(
            "https://gateway.test", "0123456789abcdef0123456789abcdef", client
        )
        paths = await resolver.materialize(
            UUID("00000000-0000-0000-0000-000000000005"),
            [InputFileId(input_id)],
            tmp_path,
        )

    assert paths[InputFileId(input_id)].read_bytes() == b"hello"
    assert not list(tmp_path.glob("*.part"))
