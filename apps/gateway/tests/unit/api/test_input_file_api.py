from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi.testclient import TestClient
from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
from gateway.core.config import Settings
from gateway.schemas.input_files import MAX_INPUT_FILE_BYTES

from tests.unit.fakes import FakeInputFileService

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


def test_rest_input_file_endpoints_require_auth_and_delegate(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(
        rest_token_verifier=StaticTokenVerifier(
            {
                "test-token": {
                    "client_id": "test-client",
                    "scopes": [],
                    "sub": "user-a",
                }
            }
        )
    )
    app.state.input_file_service = FakeInputFileService()
    service = FakeInputFileService()
    app.state.input_file_service = service

    with TestClient(app) as client:
        unauthorized = client.post(
            "/v1/input-files",
            json={"original_filename": "binder.pdb", "size_bytes": 1024},
        )
        created = client.post(
            "/v1/input-files",
            json={"original_filename": "binder.pdb", "size_bytes": 1024},
            headers={"Authorization": "Bearer test-token"},
        )
        downloaded = client.get(
            f"/v1/input-files/{service.input_file_id}/download-url",
            headers={"Authorization": "Bearer test-token"},
        )
        deleted = client.delete(
            f"/v1/input-files/{service.input_file_id}",
            headers={"Authorization": "Bearer test-token"},
        )

    assert unauthorized.status_code == 401
    assert created.status_code == 201
    assert created.json()["id"] == str(service.input_file_id)
    assert service.uploaded_for == ("user-a", "binder.pdb", 1024)
    assert downloaded.status_code == 200
    assert downloaded.json()["download_url"] == "http://seaweedfs/download"
    assert service.downloaded_for == ("user-a", service.input_file_id)
    assert deleted.status_code == 204
    assert service.deleted_for == ("user-a", service.input_file_id)


def test_rest_input_file_access_hides_other_owners(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(
        rest_token_verifier=StaticTokenVerifier(
            {
                "other-user-token": {
                    "client_id": "test-client",
                    "scopes": [],
                    "sub": "user-b",
                }
            }
        )
    )
    app.state.input_file_service = FakeInputFileService()

    with TestClient(app) as client:
        response = client.get(
            f"/v1/input-files/{uuid4()}/download-url",
            headers={"Authorization": "Bearer other-user-token"},
        )

    assert response.status_code == 404
    assert response.json()["type"] == "urn:taskome:error:input-file-not-found"


def test_create_input_file_rejects_non_strict_and_oversized_filenames(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(
        rest_token_verifier=StaticTokenVerifier(
            {"test-token": {"client_id": "test-client", "scopes": [], "sub": "user-a"}}
        )
    )
    app.state.input_file_service = FakeInputFileService()

    with TestClient(app) as client:
        non_string = client.post(
            "/v1/input-files",
            json={"original_filename": 42, "size_bytes": 1024},
            headers={"Authorization": "Bearer test-token"},
        )
        coercible_size = client.post(
            "/v1/input-files",
            json={"original_filename": "binder.pdb", "size_bytes": "1024"},
            headers={"Authorization": "Bearer test-token"},
        )
        too_long = client.post(
            "/v1/input-files",
            json={"original_filename": "x" * 256, "size_bytes": 1024},
            headers={"Authorization": "Bearer test-token"},
        )

    assert non_string.status_code == 422
    assert coercible_size.status_code == 422
    assert too_long.status_code == 422


def test_create_input_file_bounds_the_declared_object_size(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(
        rest_token_verifier=StaticTokenVerifier(
            {"test-token": {"client_id": "test-client", "scopes": [], "sub": "user-a"}}
        )
    )
    headers = {"Authorization": "Bearer test-token"}

    with TestClient(app) as client:
        empty = client.post(
            "/v1/input-files",
            json={"original_filename": "binder.pdb", "size_bytes": 0},
            headers=headers,
        )
        too_large = client.post(
            "/v1/input-files",
            json={
                "original_filename": "binder.pdb",
                "size_bytes": MAX_INPUT_FILE_BYTES + 1,
            },
            headers=headers,
        )

    assert empty.status_code == 422
    assert too_large.status_code == 422


def test_gateway_rejects_an_oversized_request_body(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(Settings(request_body_max_bytes=32))

    with TestClient(app) as client:
        response = client.post(
            "/v1/input-files",
            content=b'\x7b"original_filename":"' + (b"x" * 64) + b'"\x7d',
            headers={"Content-Type": "application/json"},
        )

    assert response.status_code == 413
