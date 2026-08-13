from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import httpx2
import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from fastmcp.server.auth.providers.jwt import JWTVerifier
from gateway.core.auth import (
    ManagedJWTVerifier,
    create_mcp_token_verifier,
    create_rest_token_verifier,
)
from gateway.core.config import Environment, Settings

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _signed_token(
    *,
    issuer: str,
    audience: str,
    client_id: str | None = None,
) -> tuple[str, dict[str, list[dict[str, str]]]]:
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key().public_bytes_raw()
    jwks = {
        "keys": [
            {
                "alg": "EdDSA",
                "crv": "Ed25519",
                "kid": "test-key",
                "kty": "OKP",
                "use": "sig",
                "x": _base64url(public_key),
            },
        ],
    }
    claims = {
        "aud": audience,
        "exp": datetime.now(UTC) + timedelta(minutes=5),
        "iat": datetime.now(UTC),
        "iss": issuer,
        "sub": "user-123",
    }
    if client_id is not None:
        claims["azp"] = client_id
    token = jwt.encode(
        claims,
        private_key,
        algorithm="EdDSA",
        headers={"kid": "test-key"},
    )
    return token, jwks


def _verifier(
    *,
    jwks: dict[str, list[dict[str, str]]],
    issuer: str,
    audience: str,
) -> JWTVerifier:
    async def jwks_handler(_request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=jwks)

    return JWTVerifier(
        jwks_uri="http://auth.test/api/auth/jwks",
        issuer=issuer,
        audience=audience,
        algorithm="EdDSA",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(jwks_handler)),
    )


def test_rest_accepts_session_jwt_as_principal(
    create_test_app: Callable[..., FastAPI],
) -> None:
    token, jwks = _signed_token(
        issuer="http://localhost:3000",
        audience="http://localhost:8000/v1",
    )
    app = create_test_app(
        Settings(app_environment=Environment.TEST),
        rest_token_verifier=_verifier(
            jwks=jwks,
            issuer="http://localhost:3000",
            audience="http://localhost:8000/v1",
        ),
    )

    with TestClient(app) as client:
        response = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "user_id": "user-123",
        "credential_kind": "session_jwt",
        "credential_id": None,
    }


def test_rest_rejects_mcp_oauth_access_token(
    create_test_app: Callable[..., FastAPI],
) -> None:
    token, jwks = _signed_token(
        issuer="http://localhost:3000/api/auth",
        audience="http://localhost:8000/mcp",
        client_id="mcp-client",
    )
    app = create_test_app(
        Settings(app_environment=Environment.TEST),
        rest_token_verifier=_verifier(
            jwks=jwks,
            issuer="http://localhost:3000",
            audience="http://localhost:8000/v1",
        ),
    )

    with TestClient(app) as client:
        response = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_rest_rejects_missing_bearer_token(create_test_app: Callable[..., FastAPI]) -> None:
    app = create_test_app()

    with TestClient(app) as client:
        response = client.get("/v1/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.headers["content-type"].startswith("application/problem+json")


def test_channel_verifiers_derive_distinct_issuers_and_resources() -> None:
    settings = Settings(
        better_auth_url="https://example.com",
        web_internal_url="http://web:3000",
        gateway_public_url="https://api.example.com",
        app_environment=Environment.TEST,
    )

    rest_verifier = create_rest_token_verifier(settings)
    mcp_verifier = create_mcp_token_verifier(settings)

    assert rest_verifier.jwks_uri == "http://web:3000/api/auth/jwks"
    assert rest_verifier.issuer == "https://example.com"
    assert rest_verifier.audience == "https://api.example.com/v1"
    assert isinstance(mcp_verifier.token_verifier, ManagedJWTVerifier)
    assert mcp_verifier.token_verifier.jwks_uri == "http://web:3000/api/auth/jwks"
    assert mcp_verifier.token_verifier.issuer == "https://example.com/api/auth"
    assert mcp_verifier.token_verifier.audience == "https://api.example.com/mcp"
