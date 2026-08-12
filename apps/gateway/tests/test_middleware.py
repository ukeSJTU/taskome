from uuid import UUID

from fastapi.testclient import TestClient
from gateway.core.config import Environment, Settings
from gateway.main import create_app


def test_gateway_generates_its_own_request_id() -> None:
    app = create_app(Settings(environment=Environment.TEST))

    with TestClient(app) as client:
        response = client.get(
            "/health/live",
            headers={"X-Request-ID": "caller-controlled"},
        )

    request_id = response.headers["X-Request-ID"]
    assert str(UUID(request_id)) == request_id
    assert request_id != "caller-controlled"


def test_gateway_adds_baseline_security_headers() -> None:
    app = create_app(Settings(environment=Environment.TEST))

    with TestClient(app) as client:
        response = client.get("/health/live")

    assert {
        "x-content-type-options": response.headers["X-Content-Type-Options"],
        "x-frame-options": response.headers["X-Frame-Options"],
        "x-xss-protection": response.headers["X-XSS-Protection"],
        "referrer-policy": response.headers["Referrer-Policy"],
        "permissions-policy": response.headers["Permissions-Policy"],
    } == {
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "x-xss-protection": "0",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), microphone=(), geolocation=()",
    }
    assert "Strict-Transport-Security" not in response.headers


def test_production_gateway_adds_hsts() -> None:
    app = create_app(Settings(environment=Environment.PRODUCTION))

    with TestClient(app) as client:
        response = client.get("/health/live")

    assert response.headers["Strict-Transport-Security"] == ("max-age=63072000; includeSubDomains")
