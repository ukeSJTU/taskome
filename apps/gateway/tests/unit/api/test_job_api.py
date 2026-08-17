from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi.testclient import TestClient
from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
from gateway.models.jobs import JobStatus
from gateway.services.input_files import DownloadUrl
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


def test_get_job_hides_an_output_storage_key(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)
    service.get_result = {
        "outputs": [
            {
                "download_name": "pockets.pdb",
                "media_type": "chemical/x-pdb",
                "name": "annotated_structure",
                "sha256": "a" * 64,
                "size_bytes": 1024,
                "storage_key": f"fpocket/{service.job_id}/annotated_structure",
            }
        ],
        "value": {"pocket_count": 3},
    }

    with TestClient(app) as client:
        response = client.get(f"/v1/jobs/{service.job_id}", headers=_TOKEN_HEADERS)

    assert response.status_code == 200
    assert response.json()["result"] == {
        "outputs": [
            {
                "download_name": "pockets.pdb",
                "media_type": "chemical/x-pdb",
                "name": "annotated_structure",
                "sha256": "a" * 64,
                "size_bytes": 1024,
            }
        ],
        "value": {"pocket_count": 3},
    }


def test_download_job_output_requires_an_owned_completed_output(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app, service = _authed_app(create_test_app)
    output_service = _FakeJobOutputService()
    app.state.job_output_service = output_service

    with TestClient(app) as client:
        response = client.get(
            f"/v1/jobs/{service.job_id}/outputs/annotated_structure/download-url",
            headers=_TOKEN_HEADERS,
        )

    assert response.status_code == 200
    assert response.json() == {
        "download_url": "http://seaweedfs/download",
        "expires_at": "2026-08-17T00:15:00Z",
    }
    assert output_service.requested_for == ("user-a", service.job_id, "annotated_structure")


class _FakeJobOutputService:
    def __init__(self) -> None:
        self.requested_for: tuple[str, object, str] | None = None

    async def mint_download_url(
        self, owner_user_id: str, job_id: object, output_name: str
    ) -> DownloadUrl:
        self.requested_for = (owner_user_id, job_id, output_name)
        return DownloadUrl(
            download_url="http://seaweedfs/download",
            expires_at=datetime(2026, 8, 17, 0, 15, tzinfo=UTC),
        )


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
