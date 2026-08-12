from fastapi.testclient import TestClient
from gateway.core.config import Environment, Settings
from gateway.main import create_app

from tests.helpers import available_database


def test_liveness_reports_process_alive() -> None:
    app = create_app(
        Settings(environment=Environment.TEST),
        database=available_database,
    )

    with TestClient(app) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json()["status"] == "alive"


def test_readiness_reports_lifespan_initialization() -> None:
    app = create_app(
        Settings(environment=Environment.TEST),
        database=available_database,
    )

    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["checks"] == {"database": {"status": "ok"}}
