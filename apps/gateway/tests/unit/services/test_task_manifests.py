from __future__ import annotations

import json

import httpx
from gateway.core.config import TaskServerConfig
from gateway.services.task_manifests import fetch_task_manifests
from task_kit.runtime import GatewayHMACVerifier, SignedGatewayRequest

_SECRET = "fpocket-test-secret-not-for-production-123456"  # noqa: S105
_MANIFEST_BODY = {
    "schema_version": 1,
    "server_name": "fpocket",
    "tasks": [
        {
            "name": "detect_pockets",
            "description": "Detect binding pockets.",
            "params_schema": {"type": "object", "properties": {"structure": {"type": "string"}}},
            "result_schema": {
                "type": "object",
                "properties": {"pocket_count": {"type": "integer"}},
            },
            "resources": {"num_cpus": 1, "num_gpus": 0},
            "max_duration_seconds": 600,
        }
    ],
}


def _fpocket_config(base_url: str = "http://fpocket.test") -> dict[str, TaskServerConfig]:
    return {"fpocket": TaskServerConfig(base_url=base_url, hmac_secret=_SECRET)}


async def test_fetch_task_manifests_signs_the_request_and_parses_tasks() -> None:
    verifier = GatewayHMACVerifier(_SECRET, 10_000_000_000)

    def handler(request: httpx.Request) -> httpx.Response:
        verified = verifier.verify(
            SignedGatewayRequest(
                timestamp=request.headers.get("x-taskome-timestamp"),
                signature=request.headers.get("x-taskome-signature"),
                method=request.method,
                target=request.url.path,
                body=request.content,
                job_id=request.headers.get("x-taskome-job-id"),
                traceparent=request.headers.get("traceparent"),
            )
        )
        assert verified.job_id is None
        return httpx.Response(200, json=_MANIFEST_BODY)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        registry = await fetch_task_manifests(_fpocket_config(), client)

    manifest = registry["fpocket"]["detect_pockets"]
    assert manifest.task_server_name == "fpocket"
    assert manifest.description == "Detect binding pockets."
    assert manifest.schema_version == 1
    assert manifest.params_schema == _MANIFEST_BODY["tasks"][0]["params_schema"]
    assert manifest.result_schema == _MANIFEST_BODY["tasks"][0]["result_schema"]
    assert manifest.resources.num_cpus == 1
    assert manifest.resources.num_gpus == 0
    assert manifest.max_duration_seconds == 600


async def test_fetch_task_manifests_omits_an_unreachable_server() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        del request
        return httpx.Response(503, json={"detail": "unavailable"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        registry = await fetch_task_manifests(_fpocket_config(), client)

    assert registry == {}


async def test_fetch_task_manifests_omits_a_server_with_a_malformed_manifest() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        del request
        return httpx.Response(200, content=json.dumps({"not": "a manifest"}))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        registry = await fetch_task_manifests(_fpocket_config(), client)

    assert registry == {}
