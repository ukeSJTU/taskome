# ruff: noqa: S101

from uuid import UUID

import pytest
from task_kit.runtime import GatewayHMACVerifier, SignedGatewayRequest, sign_gateway_request


def test_gateway_hmac_matches_the_fixed_protocol_example() -> None:
    request = SignedGatewayRequest(
        timestamp="1700000000",
        signature="315c84a60a0da18898a1d2b7ab40aa6261dce7ff0c26d3465548520b50a1f963",
        method="POST",
        target="/internal/tasks/echo",
        body=b'{"text":"hello"}',
        job_id="00000000-0000-0000-0000-000000000001",
        traceparent=None,
    )

    verified = GatewayHMACVerifier("0123456789abcdef0123456789abcdef", 10_000_000_000).verify(
        request
    )

    assert verified.job_id == UUID("00000000-0000-0000-0000-000000000001")


def test_gateway_hmac_rejects_a_rebound_job_id() -> None:
    request = SignedGatewayRequest(
        timestamp="1700000000",
        signature="315c84a60a0da18898a1d2b7ab40aa6261dce7ff0c26d3465548520b50a1f963",
        method="POST",
        target="/internal/tasks/echo",
        body=b'{"text":"hello"}',
        job_id="00000000-0000-0000-0000-000000000002",
        traceparent=None,
    )

    with pytest.raises(ValueError, match="invalid Gateway signature"):
        GatewayHMACVerifier("0123456789abcdef0123456789abcdef", 10_000_000_000).verify(request)


def test_sign_gateway_request_is_accepted_by_the_matching_verifier() -> None:
    job_id = UUID("00000000-0000-0000-0000-000000000003")
    body = b'{"structure":"00000000-0000-0000-0000-000000000099"}'
    secret = "0123456789abcdef0123456789abcdef"  # noqa: S105

    headers = sign_gateway_request(
        secret,
        method="POST",
        target="/internal/tasks/detect_pockets",
        body=body,
        job_id=job_id,
    )
    request = SignedGatewayRequest(
        timestamp=headers["X-Taskome-Timestamp"],
        signature=headers["X-Taskome-Signature"],
        method="POST",
        target="/internal/tasks/detect_pockets",
        body=body,
        job_id=headers["X-Taskome-Job-Id"],
        traceparent=headers.get("traceparent"),
    )

    verified = GatewayHMACVerifier(secret, 10_000_000_000).verify(request)

    assert verified.job_id == job_id


def test_sign_gateway_request_rejects_a_tampered_body_at_verification() -> None:
    secret = "0123456789abcdef0123456789abcdef"  # noqa: S105
    headers = sign_gateway_request(
        secret,
        method="GET",
        target="/internal/manifest",
        body=b"",
    )
    request = SignedGatewayRequest(
        timestamp=headers["X-Taskome-Timestamp"],
        signature=headers["X-Taskome-Signature"],
        method="GET",
        target="/internal/manifest",
        body=b"tampered",
        job_id=headers.get("X-Taskome-Job-Id"),
        traceparent=headers.get("traceparent"),
    )

    with pytest.raises(ValueError, match="invalid Gateway signature"):
        GatewayHMACVerifier(secret, 10_000_000_000).verify(request)
