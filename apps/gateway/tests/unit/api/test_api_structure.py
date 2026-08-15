from __future__ import annotations

from typing import TYPE_CHECKING

from gateway.api.v1.router import router

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI


def test_business_api_router_owns_the_versioned_namespace() -> None:
    assert router.prefix == "/v1"


def test_rest_openapi_declares_stable_operations_and_problem_responses(
    create_test_app: Callable[..., FastAPI],
) -> None:
    app = create_test_app()
    openapi = app.openapi()

    expected_operations = {
        ("/health/live", "get"): ("health", "getLiveness"),
        ("/health/ready", "get"): ("health", "getReadiness"),
        ("/v1/me", "get"): ("auth", "getCurrentIdentity"),
        ("/v1/input-files", "post"): ("input-files", "createInputFile"),
        ("/v1/input-files/{input_file_id}/download-url", "get"): (
            "input-files",
            "getInputFileDownloadUrl",
        ),
        ("/v1/input-files/{input_file_id}", "delete"): ("input-files", "deleteInputFile"),
        ("/v1/jobs", "post"): ("jobs", "createJob"),
        ("/v1/jobs/{job_id}", "get"): ("jobs", "getJob"),
        ("/v1/jobs", "get"): ("jobs", "listJobs"),
    }

    for (path, method), (tag, operation_id) in expected_operations.items():
        operation = openapi["paths"][path][method]
        assert operation["tags"] == [tag]
        assert operation["operationId"] == operation_id

    auth_responses = openapi["paths"]["/v1/me"]["get"]["responses"]
    create_responses = openapi["paths"]["/v1/input-files"]["post"]["responses"]
    download_responses = openapi["paths"]["/v1/input-files/{input_file_id}/download-url"]["get"][
        "responses"
    ]
    create_job_responses = openapi["paths"]["/v1/jobs"]["post"]["responses"]
    get_job_responses = openapi["paths"]["/v1/jobs/{job_id}"]["get"]["responses"]

    for responses, statuses in (
        (auth_responses, ("400", "401", "503", "default")),
        (create_responses, ("400", "401", "422", "503", "default")),
        (download_responses, ("400", "401", "404", "422", "503", "default")),
        (create_job_responses, ("400", "401", "404", "422", "503", "default")),
        (get_job_responses, ("400", "401", "404", "422", "503", "default")),
    ):
        for status_code in statuses:
            content = responses[status_code]["content"]
            assert content["application/problem+json"]["schema"] == {
                "$ref": "#/components/schemas/ProblemDetails"
            }
            assert "application/json" not in content

        assert responses["default"]["description"] == "Problem response"

    assert "ProblemDetails" in openapi["components"]["schemas"]
    security_schemes = openapi["components"]["securitySchemes"]
    assert security_schemes["HTTPBearer"]["scheme"] == "bearer"
    assert security_schemes["APIKeyHeader"]["in"] == "header"
    assert security_schemes["APIKeyHeader"]["name"] == "X-API-Key"
    assert openapi["paths"]["/v1/me"]["get"]["security"] == [
        {"HTTPBearer": []},
        {"APIKeyHeader": []},
    ]
