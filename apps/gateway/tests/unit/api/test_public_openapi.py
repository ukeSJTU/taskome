from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi.testclient import TestClient
from gateway.core.config import Environment, Settings
from gateway.core.public_openapi import public_openapi_schema

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


def test_public_openapi_projects_only_direct_api_client_operations(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app(
        settings=Settings(
            app_environment=Environment.PRODUCTION,
            gateway_public_url="https://api.taskome.test",
            web_gateway_hmac_secret="production-test-secret-at-least-32-characters",  # noqa: S106
        )
    )

    with TestClient(app) as client:
        full_schema = client.get("/openapi.json")

    assert full_schema.status_code == 404
    schema = public_openapi_schema(app)
    assert set(schema["paths"]) == {
        "/input-files",
        "/input-files/{input_file_id}",
        "/input-files/{input_file_id}/download-url",
        "/jobs",
        "/jobs/{job_id}",
        "/me",
    }
    assert schema["servers"] == [{"url": "https://api.taskome.test/v1"}]
    assert schema["components"]["securitySchemes"] == {
        "APIKeyHeader": {"in": "header", "name": "X-API-Key", "type": "apiKey"},
    }
    assert "HealthResponse" not in schema["components"].get("schemas", {})
    assert "ReadinessResponse" not in schema["components"].get("schemas", {})
    assert schema["components"]["schemas"]["CredentialKind"]["enum"] == ["personal_api_key"]
    for path_item in schema["paths"].values():
        for operation in path_item.values():
            assert operation["security"] == [{"APIKeyHeader": []}]


def test_public_openapi_is_cached_and_never_enables_cors(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app()

    first = public_openapi_schema(app)

    @app.get("/v1/late-route")
    async def late_route() -> dict[str, bool]:
        return {"late": True}

    second = public_openapi_schema(app)

    assert second == first
    assert "/v1/late-route" not in second["paths"]
