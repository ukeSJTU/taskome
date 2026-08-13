from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi.testclient import TestClient
from gateway.core.config import Environment, Settings

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
        response = client.get("/internal/openapi.json")
        full_schema = client.get("/openapi.json")

    assert response.status_code == 200
    assert full_schema.status_code == 404
    schema = response.json()
    assert set(schema["paths"]) == {
        "/input-files",
        "/input-files/{input_file_id}",
        "/input-files/{input_file_id}/download-url",
        "/me",
    }
    assert schema["servers"] == [{"url": "https://api.taskome.test/v1"}]
    assert schema["components"]["securitySchemes"] == {
        "APIKeyHeader": {"in": "header", "name": "X-API-Key", "type": "apiKey"}
    }
    for path_item in schema["paths"].values():
        for operation in path_item.values():
            assert operation["security"] == [{"APIKeyHeader": []}]


def test_public_openapi_is_cached_and_never_enables_cors(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app()

    with TestClient(app) as client:
        first = client.get("/internal/openapi.json", headers={"Origin": "https://app.example"})

        @app.get("/v1/late-route")
        async def late_route() -> dict[str, bool]:
            return {"late": True}

        second = client.get("/internal/openapi.json")

    assert first.status_code == 200
    assert first.headers.get("access-control-allow-origin") is None
    assert second.json() == first.json()
    assert "/v1/late-route" not in second.json()["paths"]
