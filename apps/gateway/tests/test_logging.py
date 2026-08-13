from __future__ import annotations

import json
import logging.config
import re
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi.testclient import TestClient
from gateway.core.config import Environment, Settings
from gateway.main import create_app

if TYPE_CHECKING:
    import pytest


def test_access_log_is_structured_and_omits_query_values(
    capsys: pytest.CaptureFixture[str],
) -> None:
    app = create_app(Settings(app_environment=Environment.TEST))

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
    capsys: pytest.CaptureFixture[str],
) -> None:
    app = create_app(Settings(app_environment=Environment.TEST))

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


def test_production_server_logs_are_json(
    tmp_path: Path,
) -> None:
    config_path = Path(__file__).parents[1] / "logging.prod.json"
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
