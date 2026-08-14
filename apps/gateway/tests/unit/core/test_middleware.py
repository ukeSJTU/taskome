from __future__ import annotations

import json
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi.testclient import TestClient
from gateway.core.config import Environment, Settings

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


def test_gateway_generates_its_own_request_id(create_test_app: Callable[..., FastAPI]) -> None:
    app = create_test_app()

    with TestClient(app) as client:
        response = client.get(
            "/health/live",
            headers={"X-Request-ID": "caller-controlled"},
        )

    request_id = response.headers["X-Request-ID"]
    assert str(UUID(request_id)) == request_id
    assert request_id != "caller-controlled"


def test_gateway_adds_baseline_security_headers(create_test_app: Callable[..., FastAPI]) -> None:
    app = create_test_app()

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


def test_production_gateway_adds_hsts(create_test_app: Callable[..., FastAPI]) -> None:
    app = create_test_app(Settings(app_environment=Environment.PRODUCTION))

    with TestClient(app) as client:
        response = client.get("/health/live")

    assert response.headers["Strict-Transport-Security"] == ("max-age=63072000; includeSubDomains")


def test_access_log_uses_warning_for_4xx_and_error_for_5xx(
    create_test_app: Callable[..., FastAPI],
    capsys,
) -> None:
    app = create_test_app()

    with TestClient(app, raise_server_exceptions=False) as client:
        client.get("/missing")

        @app.get("/broken")
        def broken() -> None:
            message = "boom"
            raise RuntimeError(message)

        client.get("/broken")

    events = [
        json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")
    ]
    requests = [event for event in events if event["event"] == "http_request"]
    assert any(event["status_code"] == 404 and event["level"] == "warning" for event in requests)
    assert any(event["status_code"] == 500 and event["level"] == "error" for event in requests)


def test_body_limit_applies_to_delete_requests(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(Settings(request_body_max_bytes=8))

    with TestClient(app) as client:
        response = client.request("DELETE", "/health/live", content=b"x" * 9)

    assert response.status_code == 413
