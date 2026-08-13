import base64
from datetime import UTC, datetime, timedelta

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from gateway.core.auth import JWKSVerifier
from gateway.core.config import Environment, Settings
from gateway.main import create_app

from tests.helpers import available_database


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _signed_token(*, issuer: str, audience: str) -> tuple[str, dict[str, list[dict[str, str]]]]:
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
    token = jwt.encode(
        {
            "aud": audience,
            "exp": datetime.now(UTC) + timedelta(minutes=5),
            "iat": datetime.now(UTC),
            "iss": issuer,
            "sub": "user-123",
        },
        private_key,
        algorithm="EdDSA",
        headers={"kid": "test-key"},
    )
    return token, jwks


def test_authenticated_gateway_route_accepts_jwks_verified_bearer_token() -> None:
    token, jwks = _signed_token(issuer="http://localhost:3000", audience="http://localhost:3000")

    async def jwks_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=jwks)

    verifier = JWKSVerifier(
        "http://auth.test/api/auth/jwks",
        issuers=["http://localhost:3000"],
        audiences=["http://localhost:3000"],
        client=httpx.AsyncClient(transport=httpx.MockTransport(jwks_handler)),
    )
    app = create_app(
        Settings(
            auth_issuer="http://localhost:3000",
            auth_jwks_url="http://auth.test/api/auth/jwks",
            auth_session_audience="http://localhost:3000",
            auth_oauth_audience="http://localhost:8000",
            environment=Environment.TEST,
        ),
        auth_verifier=verifier,
        database=available_database,
    )

    with TestClient(app) as client:
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {
        "aud": "http://localhost:3000",
        "iss": "http://localhost:3000",
        "sub": "user-123",
    }


def test_authenticated_gateway_route_rejects_missing_bearer_token() -> None:
    app = create_app(
        Settings(environment=Environment.TEST),
        database=available_database,
    )

    with TestClient(app) as client:
        response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.headers["content-type"].startswith("application/problem+json")


def test_mcp_route_rejects_missing_bearer_token() -> None:
    app = create_app(
        Settings(environment=Environment.TEST),
        database=available_database,
    )

    with TestClient(app) as client:
        response = client.get("/mcp")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_mcp_route_accepts_oauth_jwt_from_the_shared_jwks() -> None:
    token, jwks = _signed_token(
        issuer="http://localhost:3000/api/auth",
        audience="http://localhost:8000",
    )

    async def jwks_handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=jwks)

    verifier = JWKSVerifier(
        "http://auth.test/api/auth/jwks",
        issuers=["http://localhost:3000", "http://localhost:3000/api/auth"],
        audiences=["http://localhost:3000", "http://localhost:8000"],
        client=httpx.AsyncClient(transport=httpx.MockTransport(jwks_handler)),
    )
    app = create_app(
        Settings(
            auth_issuer="http://localhost:3000",
            auth_jwks_url="http://auth.test/api/auth/jwks",
            auth_oauth_issuer="http://localhost:3000/api/auth",
            auth_session_audience="http://localhost:3000",
            auth_oauth_audience="http://localhost:8000",
            environment=Environment.TEST,
        ),
        auth_verifier=verifier,
        database=available_database,
    )

    with TestClient(app) as client:
        response = client.get("/mcp", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code != 401
