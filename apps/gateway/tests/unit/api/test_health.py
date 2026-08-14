from __future__ import annotations

import asyncio
import time
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


def test_readiness_reports_not_yet_ready_without_calling_dependencies(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app()

    with TestClient(app) as client:
        app.state.ready = False
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["checks"] == {
        "database": {"status": "error"},
        "redis": {"status": "error"},
    }


def test_readiness_reports_unavailable_dependencies(
    create_test_app: Callable[..., FastAPI],
) -> None:
    class UnavailableDatabase:
        async def is_available(self) -> bool:
            return False

    class UnavailableRedis:
        async def ping(self) -> bool:
            return False

    app = create_test_app()

    with TestClient(app) as client:
        app.state.database = UnavailableDatabase()
        app.state.redis = UnavailableRedis()
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"


def test_readiness_treats_dependency_timeouts_as_unhealthy(
    create_test_app: Callable[..., FastAPI],
) -> None:
    class TimedOutDependency:
        async def is_available(self) -> bool:
            raise TimeoutError

        async def ping(self) -> bool:
            raise TimeoutError

    app = create_test_app()

    with TestClient(app) as client:
        dependency = TimedOutDependency()
        app.state.database = dependency
        app.state.redis = dependency
        response = client.get("/health/ready")

    assert response.status_code == 503


def test_readiness_checks_database_and_redis_concurrently(
    create_test_app: Callable[..., FastAPI],
) -> None:
    class SlowDatabase:
        async def is_available(self) -> bool:
            await asyncio.sleep(0.1)
            return True

    class SlowRedis:
        async def ping(self) -> bool:
            await asyncio.sleep(0.1)
            return True

    app = create_test_app()

    with TestClient(app) as client:
        app.state.database = SlowDatabase()
        app.state.redis = SlowRedis()
        started_at = time.perf_counter()
        response = client.get("/health/ready")
        elapsed = time.perf_counter() - started_at

    assert response.status_code == 200
    assert elapsed < 0.18
