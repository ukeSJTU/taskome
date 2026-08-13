from __future__ import annotations

import hashlib
import hmac
import json

import httpx
import pytest
from gateway.core.personal_api_keys import (
    PersonalApiKeyVerificationUnavailableError,
    WebPersonalApiKeyVerifier,
)


@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        ({"active": True, "user_id": "user-1", "key_id": "key-1"}, ("user-1", "key-1")),
        ({"active": False, "user_id": None, "key_id": None}, None),
    ],
)
async def test_web_verifier_signs_the_exact_body_and_maps_the_response(
    payload: dict[str, object],
    expected: tuple[str, str] | None,
) -> None:
    secret = "shared-secret-at-least-32-characters"  # noqa: S105 - Test-only secret.

    async def handler(request: httpx.Request) -> httpx.Response:
        body = request.content
        timestamp = request.headers["X-Taskome-Timestamp"]
        expected_signature = hmac.new(
            secret.encode(),
            timestamp.encode() + b"." + body,
            hashlib.sha256,
        ).hexdigest()
        assert request.url == "http://web:3000/api/internal/personal-api-keys/verify"
        assert request.headers["X-Taskome-Signature"] == expected_signature
        assert json.loads(body) == {"key": "taskome_secret"}
        return httpx.Response(200, json=payload)

    verifier = WebPersonalApiKeyVerifier(
        url="http://web:3000/api/internal/personal-api-keys/verify",
        secret=secret,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        clock=lambda: 1_800_000_000,
    )

    result = await verifier.verify("taskome_secret")

    actual = None if result is None else (result.user_id, result.key_id)
    assert actual == expected


@pytest.mark.parametrize(
    "response",
    [httpx.Response(500), httpx.Response(200, json={"oops": True})],
)
async def test_web_verifier_maps_transport_or_protocol_failures_to_unavailable(
    response: httpx.Response,
) -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return response

    verifier = WebPersonalApiKeyVerifier(
        url="http://web:3000/api/internal/personal-api-keys/verify",
        secret="shared-secret-at-least-32-characters",  # noqa: S106 - Test-only secret.
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(PersonalApiKeyVerificationUnavailableError):
        await verifier.verify("taskome_secret")
