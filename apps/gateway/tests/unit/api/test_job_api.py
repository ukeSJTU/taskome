from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi.testclient import TestClient
from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
from gateway.models.jobs import JobStatus
from gateway.services.jobs import (
    InvalidJobParamsError,
    JobInputFileNotFoundError,
    TaskNotFoundError,
)

from tests.unit.fakes import FakeJobService

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI

_TOKEN_HEADERS = {"Authorization": "Bearer test-token"}


def _authed_app(create_test_app: Callable[..., FastAPI]) -> tuple[FastAPI, FakeJobService]:
    app = create_test_app(
        rest_token_verifier=StaticTokenVerifier(
            {"test-token": {"client_id": "test-client", "scopes": [], "sub": "user-a"}}
        )
    )
    service = FakeJobService()
    app.state.job_service = service
    return app, service


def test_create_job_requires_auth_and_delegates(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)
    body = {"task_server_name": "fpocket", "task_name": "detect_pockets", "params": {"a": 1}}

    with TestClient(app) as client:
        unauthorized = client.post("/v1/jobs", json=body)
        created = client.post("/v1/jobs", json=body, headers=_TOKEN_HEADERS)

    assert unauthorized.status_code == 401
    assert created.status_code == 202
    assert created.json()["id"] == str(service.job_id)
    assert created.json()["status"] == "queued"
    assert service.submitted_for == ("user-a", "fpocket", "detect_pockets", {"a": 1})


def test_create_job_maps_task_not_found_to_404(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)
    service.raise_on_submit = TaskNotFoundError()

    with TestClient(app) as client:
        response = client.post(
            "/v1/jobs",
            json={"task_server_name": "fpocket", "task_name": "no_such_task", "params": {}},
            headers=_TOKEN_HEADERS,
        )

    assert response.status_code == 404
    assert response.json()["type"] == "urn:taskome:error:task-not-found"


def test_create_job_maps_invalid_params_to_422(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)
    service.raise_on_submit = InvalidJobParamsError("bad params")

    with TestClient(app) as client:
        response = client.post(
            "/v1/jobs",
            json={"task_server_name": "fpocket", "task_name": "detect_pockets", "params": {}},
            headers=_TOKEN_HEADERS,
        )

    assert response.status_code == 422
    assert response.json()["type"] == "urn:taskome:error:invalid-job-params"


def test_create_job_maps_missing_input_file_to_404(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)
    service.raise_on_submit = JobInputFileNotFoundError("structure", uuid4())

    with TestClient(app) as client:
        response = client.post(
            "/v1/jobs",
            json={"task_server_name": "fpocket", "task_name": "detect_pockets", "params": {}},
            headers=_TOKEN_HEADERS,
        )

    assert response.status_code == 404
    assert response.json()["type"] == "urn:taskome:error:job-input-file-not-found"


def test_get_job_returns_the_callers_own_job(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)

    with TestClient(app) as client:
        response = client.get(f"/v1/jobs/{service.job_id}", headers=_TOKEN_HEADERS)

    assert response.status_code == 200
    assert response.json()["id"] == str(service.job_id)
    assert service.fetched_for == ("user-a", service.job_id)


def test_get_job_hides_a_job_the_caller_does_not_own(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(
        rest_token_verifier=StaticTokenVerifier(
            {"other-user-token": {"client_id": "test-client", "scopes": [], "sub": "user-b"}}
        )
    )
    app.state.job_service = FakeJobService()

    with TestClient(app) as client:
        response = client.get(
            f"/v1/jobs/{uuid4()}", headers={"Authorization": "Bearer other-user-token"}
        )

    assert response.status_code == 404
    assert response.json()["type"] == "urn:taskome:error:job-not-found"


def test_list_jobs_forwards_filters_and_pagination(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)

    with TestClient(app) as client:
        response = client.get(
            "/v1/jobs?status=completed&task_name=detect_pockets&limit=10&offset=5",
            headers=_TOKEN_HEADERS,
        )

    assert response.status_code == 200
    assert len(response.json()["jobs"]) == 1
    assert service.listed_for == ("user-a", JobStatus.COMPLETED, "detect_pockets", 10, 5)


def test_list_jobs_defaults_to_no_filter(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)

    with TestClient(app) as client:
        client.get("/v1/jobs", headers=_TOKEN_HEADERS)

    assert service.listed_for == ("user-a", None, None, 50, 0)
