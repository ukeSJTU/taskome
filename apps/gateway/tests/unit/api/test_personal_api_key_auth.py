from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi.testclient import TestClient
from gateway.core.personal_api_keys import (
    PersonalApiKeyVerificationUnavailableError,
    VerifiedPersonalApiKey,
)

from tests.unit.fakes import FakeInputFileService

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


class FakePersonalApiKeyVerifier:
    def __init__(self, result: VerifiedPersonalApiKey | None) -> None:
        self.result = result
        self.keys: list[str] = []

    async def verify(self, key: str) -> VerifiedPersonalApiKey | None:
        self.keys.append(key)
        return self.result

    async def aclose(self) -> None:
        pass


class UnavailablePersonalApiKeyVerifier:
    async def verify(self, key: str) -> VerifiedPersonalApiKey | None:  # noqa: ARG002
        raise PersonalApiKeyVerificationUnavailableError

    async def aclose(self) -> None:
        pass


def test_personal_api_key_authenticates_every_v1_request_as_its_user(
    create_test_app: Callable[..., FastAPI],
) -> None:
    verifier = FakePersonalApiKeyVerifier(
        VerifiedPersonalApiKey(user_id="user-a", key_id="key-123")
    )
    app = create_test_app(personal_api_key_verifier=verifier)
    service = FakeInputFileService()
    app.state.input_file_service = service
    headers = {"X-API-Key": "taskome_direct-secret"}

    with TestClient(app) as client:
        identity = client.get("/v1/me", headers=headers)
        created = client.post(
            "/v1/input-files",
            json={"original_filename": "binder.pdb"},
            headers=headers,
        )
        downloaded = client.get(
            f"/v1/input-files/{service.input_file_id}/download-url",
            headers=headers,
        )
        deleted = client.delete(
            f"/v1/input-files/{service.input_file_id}",
            headers=headers,
        )

    assert identity.status_code == 200
    assert identity.json() == {
        "user_id": "user-a",
        "credential_kind": "personal_api_key",
        "credential_id": "key-123",
    }
    assert created.status_code == 201
    assert downloaded.status_code == 200
    assert deleted.status_code == 204
    assert service.uploaded_for == ("user-a", "binder.pdb")
    assert service.downloaded_for == ("user-a", service.input_file_id)
    assert service.deleted_for == ("user-a", service.input_file_id)
    assert verifier.keys == ["taskome_direct-secret"] * 4


def test_invalid_personal_api_key_returns_401(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(personal_api_key_verifier=FakePersonalApiKeyVerifier(None))

    with TestClient(app) as client:
        response = client.get("/v1/me", headers={"X-API-Key": "taskome_invalid"})

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")


def test_personal_api_key_cannot_disclose_another_users_input_file(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(
        personal_api_key_verifier=FakePersonalApiKeyVerifier(
            VerifiedPersonalApiKey(user_id="user-b", key_id="key-b")
        )
    )
    app.state.input_file_service = FakeInputFileService()

    with TestClient(app) as client:
        response = client.get(
            f"/v1/input-files/{uuid4()}/download-url",
            headers={"X-API-Key": "taskome_user-b"},
        )

    assert response.status_code == 404
    assert response.json()["type"] == "urn:taskome:error:input-file-not-found"


def test_personal_api_key_verifier_unavailability_returns_503(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(personal_api_key_verifier=UnavailablePersonalApiKeyVerifier())

    with TestClient(app) as client:
        response = client.get("/v1/me", headers={"X-API-Key": "taskome_unavailable"})

    assert response.status_code == 503
    assert response.json()["type"] == "urn:taskome:error:personal-api-key-verifier-unavailable"


def test_rest_rejects_ambiguous_credentials_without_verifying_either(
    create_test_app: Callable[..., FastAPI],
) -> None:
    verifier = FakePersonalApiKeyVerifier(
        VerifiedPersonalApiKey(user_id="user-a", key_id="key-123")
    )
    app = create_test_app(personal_api_key_verifier=verifier)

    with TestClient(app) as client:
        response = client.get(
            "/v1/me",
            headers={
                "Authorization": "Bearer session-token",
                "X-API-Key": "taskome_direct-secret",
            },
        )

    assert response.status_code == 400
    assert response.json()["type"] == "urn:taskome:error:ambiguous-credentials"
    assert verifier.keys == []


def test_rest_rejects_non_bearer_authorization_with_personal_api_key(
    create_test_app: Callable[..., FastAPI],
) -> None:
    verifier = FakePersonalApiKeyVerifier(
        VerifiedPersonalApiKey(user_id="user-a", key_id="key-123")
    )
    app = create_test_app(personal_api_key_verifier=verifier)

    with TestClient(app) as client:
        response = client.get(
            "/v1/me",
            headers={
                "Authorization": "Basic malformed-credential",
                "X-API-Key": "taskome_direct-secret",
            },
        )

    assert response.status_code == 400
    assert response.json()["type"] == "urn:taskome:error:ambiguous-credentials"
    assert verifier.keys == []
