# ruff: noqa: S101

from uuid import UUID

import pytest
from task_kit.runtime import GatewayHMACVerifier, SignedGatewayRequest


def test_gateway_hmac_matches_the_fixed_protocol_example() -> None:
    request = SignedGatewayRequest(
        timestamp="1700000000",
        signature="f5482a73857803e307539f97f691e69b0487ae32a3316588dd53030ca00ad7ef",
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
        signature="f5482a73857803e307539f97f691e69b0487ae32a3316588dd53030ca00ad7ef",
        method="POST",
        target="/internal/tasks/echo",
        body=b'{"text":"hello"}',
        job_id="00000000-0000-0000-0000-000000000002",
        traceparent=None,
    )

    with pytest.raises(ValueError, match="invalid Gateway signature"):
        GatewayHMACVerifier("0123456789abcdef0123456789abcdef", 10_000_000_000).verify(request)
