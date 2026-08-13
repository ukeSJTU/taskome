from __future__ import annotations

from typing import TYPE_CHECKING

from gateway.api.v1.router import auth_api_router, router

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


def test_business_api_router_owns_the_versioned_namespace() -> None:
    assert router.prefix == "/v1"
    assert auth_api_router.prefix == "/api/v1"


def test_rest_openapi_declares_stable_operations_and_problem_responses(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app()
    openapi = app.openapi()

    expected_operations = {
        ("/health/live", "get"): ("health", "getLiveness"),
        ("/health/ready", "get"): ("health", "getReadiness"),
        ("/api/v1/auth/me", "get"): ("auth", "getCurrentIdentity"),
        ("/v1/input-files", "post"): ("input-files", "createInputFile"),
        ("/v1/input-files/{input_file_id}/download-url", "get"): (
            "input-files",
            "getInputFileDownloadUrl",
        ),
        ("/v1/input-files/{input_file_id}", "delete"): ("input-files", "deleteInputFile"),
    }

    for (path, method), (tag, operation_id) in expected_operations.items():
        operation = openapi["paths"][path][method]
        assert operation["tags"] == [tag]
        assert operation["operationId"] == operation_id

    auth_responses = openapi["paths"]["/api/v1/auth/me"]["get"]["responses"]
    create_responses = openapi["paths"]["/v1/input-files"]["post"]["responses"]
    download_responses = openapi["paths"]["/v1/input-files/{input_file_id}/download-url"]["get"][
        "responses"
    ]

    for responses, statuses in (
        (auth_responses, ("401", "default")),
        (create_responses, ("401", "422", "default")),
        (download_responses, ("401", "404", "422", "default")),
    ):
        for status_code in statuses:
            content = responses[status_code]["content"]
            assert content["application/problem+json"]["schema"] == {
                "$ref": "#/components/schemas/ProblemDetails"
            }
            assert "application/json" not in content

        assert responses["default"]["description"] == "Problem response"

    assert "ProblemDetails" in openapi["components"]["schemas"]
