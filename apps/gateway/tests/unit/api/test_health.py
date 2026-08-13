from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi.testclient import TestClient

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


def test_liveness_reports_process_alive(create_test_app: Callable[..., FastAPI]) -> None:
    app = create_test_app()

    with TestClient(app) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json()["status"] == "alive"


def test_readiness_reports_lifespan_initialization(create_test_app: Callable[..., FastAPI]) -> None:
    app = create_test_app()

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["checks"] == {
        "database": {"status": "ok"},
        "redis": {"status": "ok"},
    }
