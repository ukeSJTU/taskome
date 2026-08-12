from __future__ import annotations

import json
from typing import TYPE_CHECKING, Annotated

from fastapi import Path
from fastapi.testclient import TestClient
from gateway.core.config import Environment, Settings
from gateway.core.errors import AppError
from gateway.main import create_app

if TYPE_CHECKING:
    import pytest


def test_not_found_uses_problem_details() -> None:
    app = create_app(Settings(environment=Environment.TEST))

    with TestClient(app) as client:
        response = client.get("/does-not-exist")

    problem = response.json()
    assert response.status_code == 404
    assert response.headers["Content-Type"] == "application/problem+json"
    assert problem == {
        "type": "urn:taskome:error:not-found",
        "title": "Not Found",
        "status": 404,
        "detail": "The requested resource was not found.",
        "instance": "/does-not-exist",
        "request_id": response.headers["X-Request-ID"],
    }


def test_request_validation_uses_problem_details() -> None:
    app = create_app(Settings(environment=Environment.TEST))

    @app.get("/items/{item_id}")
    def read_item(item_id: Annotated[int, Path(gt=0)]) -> dict[str, int]:
        return {"item_id": item_id}

    with TestClient(app) as client:
        response = client.get("/items/0")

    problem = response.json()
    assert response.status_code == 422
    assert response.headers["Content-Type"] == "application/problem+json"
    assert problem["type"] == "urn:taskome:error:request-validation"
    assert problem["request_id"] == response.headers["X-Request-ID"]
    assert problem["errors"] == [
        {
            "location": ["path", "item_id"],
            "message": "Input should be greater than 0",
            "code": "greater_than",
        },
    ]


def test_application_errors_use_problem_details() -> None:
    app = create_app(Settings(environment=Environment.TEST))

    @app.get("/conflict")
    def conflict() -> None:
        raise AppError(
            error_type="conflict",
            title="Conflict",
            status_code=409,
            detail="The resource already exists.",
        )

    with TestClient(app) as client:
        response = client.get("/conflict")

    problem = response.json()
    assert response.status_code == 409
    assert problem["type"] == "urn:taskome:error:conflict"
    assert problem["detail"] == "The resource already exists."
    assert problem["request_id"] == response.headers["X-Request-ID"]


def test_unhandled_errors_hide_internal_details() -> None:
    app = create_app(Settings(environment=Environment.TEST))

    @app.get("/unexpected")
    def unexpected() -> None:
        message = "database-password-leaked"
        raise RuntimeError(message)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/unexpected")

    problem = response.json()
    assert response.status_code == 500
    assert response.headers["Content-Type"] == "application/problem+json"
    assert problem["type"] == "urn:taskome:error:internal-error"
    assert problem["detail"] == "An unexpected error occurred."
    assert "database-password-leaked" not in response.text
    assert problem["request_id"] == response.headers["X-Request-ID"]
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_unhandled_errors_are_logged_with_request_context(
    capsys: pytest.CaptureFixture[str],
) -> None:
    app = create_app(Settings(environment=Environment.TEST))

    @app.get("/unexpected")
    def unexpected() -> None:
        message = "diagnostic-detail"
        raise RuntimeError(message)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/unexpected")

    events = [
        json.loads(line) for line in capsys.readouterr().out.splitlines() if line.startswith("{")
    ]
    error_event = next(event for event in events if event["event"] == "unhandled_error")
    assert error_event["request_id"] == response.headers["X-Request-ID"]
    assert "diagnostic-detail" in error_event["exception"]
