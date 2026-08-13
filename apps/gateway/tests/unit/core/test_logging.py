from __future__ import annotations

import json
import logging.config
import re
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi.testclient import TestClient
from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
from gateway.core.personal_api_keys import VerifiedPersonalApiKey

if TYPE_CHECKING:
    from collections.abc import Callable

    import pytest
    from fastapi import FastAPI


def test_access_log_is_structured_and_omits_query_values(
    create_test_app: Callable[..., FastAPI],
    capsys: pytest.CaptureFixture[str],
) -> None:
    app = create_test_app()

    with TestClient(app) as client:
        response = client.get("/does-not-exist?token=secret-value")

    events = [
        json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")
    ]
    access_event = next(event for event in events if event["event"] == "http_request")
    assert {
        "method": access_event["method"],
        "path": access_event["path"],
        "status_code": access_event["status_code"],
        "request_id": access_event["request_id"],
    } == {
        "method": "GET",
        "path": "/does-not-exist",
        "status_code": 404,
        "request_id": response.headers["X-Request-ID"],
    }
    assert access_event["duration_ms"] >= 0
    assert "secret-value" not in json.dumps(access_event)


def test_access_log_uses_route_template_and_trace_context(
    create_test_app: Callable[..., FastAPI],
    capsys: pytest.CaptureFixture[str],
) -> None:
    app = create_test_app()

    @app.get("/items/{item_id}")
    def read_item(item_id: int) -> dict[str, int]:
        return {"item_id": item_id}

    with TestClient(app) as client:
        client.get("/items/42")

    events = [
        json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")
    ]
    access_event = next(event for event in events if event["event"] == "http_request")
    assert access_event["path"] == "/items/{item_id}"
    assert re.fullmatch(r"[0-9a-f]{32}", access_event["trace_id"])


def test_authenticated_access_log_carries_principal_without_raw_credential(
    create_test_app: Callable[..., FastAPI],
    capsys: pytest.CaptureFixture[str],
) -> None:
    raw_token = "session-secret-token"  # noqa: S105 - Deliberate canary for log redaction.
    app = create_test_app(
        rest_token_verifier=StaticTokenVerifier(
            {
                raw_token: {
                    "client_id": "ignored-for-session",
                    "scopes": [],
                    "sub": "user-123",
                }
            }
        )
    )

    with TestClient(app) as client:
        response = client.get(
            "/v1/me",
            headers={"Authorization": f"Bearer {raw_token}"},
        )

    events = [
        json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")
    ]
    access_event = next(event for event in events if event["event"] == "http_request")
    assert response.status_code == 200
    assert access_event["user_id"] == "user-123"
    assert access_event["credential_kind"] == "session_jwt"
    assert access_event["credential_id"] is None
    assert raw_token not in json.dumps(access_event)


def test_personal_api_key_access_log_carries_only_non_secret_identity(
    create_test_app: Callable[..., FastAPI],
    capsys: pytest.CaptureFixture[str],
) -> None:
    raw_key = "taskome_log-secret-canary"

    class Verifier:
        async def verify(self, key: str) -> VerifiedPersonalApiKey | None:
            assert key == raw_key
            return VerifiedPersonalApiKey(user_id="user-123", key_id="key-123")

        async def aclose(self) -> None:
            pass

    app = create_test_app(personal_api_key_verifier=Verifier())

    with TestClient(app) as client:
        response = client.get("/v1/me", headers={"X-API-Key": raw_key})

    events = [
        json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")
    ]
    access_event = next(event for event in events if event["event"] == "http_request")
    assert response.status_code == 200
    assert access_event["user_id"] == "user-123"
    assert access_event["credential_kind"] == "personal_api_key"
    assert access_event["credential_id"] == "key-123"
    assert raw_key not in json.dumps(events)


def test_production_server_logs_are_json(
    tmp_path: Path,
) -> None:
    config_path = Path(__file__).parents[3] / "logging.prod.json"
    log_config = json.loads(config_path.read_text())
    default_handler = log_config["handlers"]["default"]
    default_handler["class"] = "logging.FileHandler"
    default_handler["filename"] = str(tmp_path / "server.log")
    default_handler.pop("stream")
    logging.config.dictConfig(log_config)

    logging.getLogger("uvicorn.error").info("Application startup complete.")

    event = json.loads((tmp_path / "server.log").read_text())
    assert event["event"] == "Application startup complete."
    assert event["level"] == "info"
