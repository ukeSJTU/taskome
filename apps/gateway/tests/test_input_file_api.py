from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from fastmcp.server.auth.providers.jwt import StaticTokenVerifier
from gateway.core.config import Environment, Settings
from gateway.main import create_app
from gateway.services.input_files import (
    DownloadUrl,
    InputFileNotFoundError,
    UploadUrl,
)

from tests.helpers import available_database


class FakeInputFileService:
    def __init__(self) -> None:
        self.uploaded_for: tuple[str, str] | None = None
        self.downloaded_for: tuple[str, UUID] | None = None
        self.deleted_for: tuple[str, UUID] | None = None
        self.input_file_id = uuid4()

    async def mint_upload_url(self, owner_user_id: str, original_filename: str) -> UploadUrl:
        self.uploaded_for = (owner_user_id, original_filename)
        return UploadUrl(
            id=self.input_file_id,
            upload_url="http://seaweedfs/upload",
            expires_at=datetime.now(UTC),
        )

    async def mint_download_url(self, owner_user_id: str, input_file_id: UUID) -> DownloadUrl:
        self.downloaded_for = (owner_user_id, input_file_id)
        if owner_user_id != "user-a":
            raise InputFileNotFoundError
        return DownloadUrl(
            download_url="http://seaweedfs/download",
            expires_at=datetime.now(UTC),
        )

    async def delete(self, owner_user_id: str, input_file_id: UUID) -> None:
        self.deleted_for = (owner_user_id, input_file_id)
        if owner_user_id != "user-a":
            raise InputFileNotFoundError


def test_rest_input_file_endpoints_require_auth_and_delegate() -> None:
    app = create_app(Settings(environment=Environment.TEST), database=available_database)
    service = FakeInputFileService()
    app.state.input_file_service = service
    app.state.token_verifier = StaticTokenVerifier(
        {
            "test-token": {
                "client_id": "test-client",
                "scopes": [],
                "sub": "user-a",
            }
        }
    )

    with TestClient(app) as client:
        unauthorized = client.post(
            "/v1/input-files",
            json={"original_filename": "binder.pdb"},
        )
        created = client.post(
            "/v1/input-files",
            json={"original_filename": "binder.pdb"},
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
    assert service.uploaded_for == ("user-a", "binder.pdb")
    assert downloaded.status_code == 200
    assert downloaded.json()["download_url"] == "http://seaweedfs/download"
    assert service.downloaded_for == ("user-a", service.input_file_id)
    assert deleted.status_code == 204
    assert service.deleted_for == ("user-a", service.input_file_id)


def test_rest_input_file_access_hides_other_owners() -> None:
    app = create_app(Settings(environment=Environment.TEST), database=available_database)
    app.state.input_file_service = FakeInputFileService()
    app.state.token_verifier = StaticTokenVerifier(
        {
            "other-user-token": {
                "client_id": "test-client",
                "scopes": [],
                "sub": "user-b",
            }
        }
    )

    with TestClient(app) as client:
        response = client.get(
            f"/v1/input-files/{uuid4()}/download-url",
            headers={"Authorization": "Bearer other-user-token"},
        )

    assert response.status_code == 404
    assert response.json()["type"] == "urn:taskome:error:input-file-not-found"
