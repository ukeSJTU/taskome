# ruff: noqa: EM101, PLR2004, S101, TRY003

import json
import shutil
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from task_kit import (
    ComputeContext,
    ComputeResult,
    InputFileId,
    ProducedFile,
    TaskDefinition,
    build_task_server,
)
from task_kit.runtime import SignedGatewayRequest, VerifiedGatewayRequest
from task_kit.testing import fake_runtime, signed_request_headers


class EchoParams(BaseModel):
    message: str = Field(alias="text")


class EchoResult(BaseModel):
    message: str


class AliasedResult(BaseModel):
    message: str = Field(alias="wire_message")


class WrongEchoResult(BaseModel):
    message: str


class EchoResultSubclass(EchoResult):
    pass


class NestedParams(BaseModel):
    payload: EchoParams


class InputParams(BaseModel):
    input_file: InputFileId


class EchoAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=params.message))


class OutputAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        output = ctx.workdir / "result.txt"
        output.write_text(params.message)
        return ComputeResult(
            value=EchoResult(message=params.message),
            outputs=(
                ProducedFile(
                    name="result",
                    relative_path=Path("result.txt"),
                    media_type="text/plain",
                    download_name="result.txt",
                ),
            ),
        )


class SymlinkOutputAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        source = ctx.workdir / "source.txt"
        source.write_text(params.message)
        (ctx.workdir / "result.txt").symlink_to(source)
        return ComputeResult(
            value=EchoResult(message=params.message),
            outputs=(
                ProducedFile(
                    name="result",
                    relative_path=Path("result.txt"),
                    media_type="text/plain",
                ),
            ),
        )


class NestedAdapter:
    def run(self, params: NestedParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=params.payload.message))


class InputAdapter:
    def run(self, params: InputParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        return ComputeResult(value=EchoResult(message=str(params.input_file.root)))


class AliasedResultAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[AliasedResult]:
        del ctx
        return ComputeResult(value=AliasedResult(wire_message=params.message))


class WrongResultClassAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        wrong_result: Any = WrongEchoResult(message=params.message)
        return ComputeResult(value=wrong_result)


class ResultSubclassAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        del ctx
        result: EchoResult = EchoResultSubclass(message=params.message)
        return ComputeResult(value=result)


class InvalidOutputNameAdapter:
    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        output = ctx.workdir / "result.txt"
        output.write_text(params.message)
        return ComputeResult(
            value=EchoResult(message=params.message),
            outputs=(
                ProducedFile(
                    name="Invalid-Name",
                    relative_path=Path("result.txt"),
                    media_type="text/plain",
                ),
            ),
        )


class CleanupFailureAdapter:
    job_root: Path | None = None

    def run(self, params: EchoParams, ctx: ComputeContext) -> ComputeResult[EchoResult]:
        self.job_root = ctx.workdir.parent
        self.job_root.chmod(0)
        return ComputeResult(value=EchoResult(message=params.message))


class SingleUseGatewayVerifier:
    def __init__(self) -> None:
        self._used = False

    def verify(self, request: SignedGatewayRequest) -> VerifiedGatewayRequest:
        if self._used:
            raise ValueError("request was verified more than once")
        self._used = True
        return VerifiedGatewayRequest(
            job_id=UUID(request.job_id) if request.job_id else None,
            traceparent=request.traceparent,
        )


def _signed_json(payload: object, job_id: str) -> tuple[bytes, dict[str, str]]:
    body = json.dumps(payload, separators=(",", ":")).encode()
    headers = signed_request_headers(
        method="POST", target="/internal/tasks/echo", body=body, job_id=UUID(job_id)
    )
    headers["content-type"] = "application/json"
    return body, headers


def test_signed_rest_executes_a_flat_params_object() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        body, headers = _signed_json({"text": "hello"}, "00000000-0000-0000-0000-000000000001")
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 200
    assert response.json() == {"value": {"message": "hello"}, "outputs": []}


def test_signed_rest_consumes_one_verified_gateway_request() -> None:
    runtime = fake_runtime()
    runtime.gateway_requests = SingleUseGatewayVerifier()
    app = build_task_server(
        name="echo",
        tasks=(TaskDefinition("echo", "Echo a message.", EchoParams, EchoResult, EchoAdapter()),),
        runtime=runtime,
    )
    body, headers = _signed_json(
        {"text": "hello"},
        "00000000-0000-0000-0000-000000000019",
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 200


def test_signed_rest_accepts_input_file_uuid_json() -> None:
    app = build_task_server(
        name="input",
        tasks=(
            TaskDefinition(
                name="resolve",
                description="Resolve an Input File.",
                params_model=InputParams,
                result_model=EchoResult,
                adapter=InputAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    input_file_id = "00000000-0000-0000-0000-000000000014"
    body = json.dumps({"input_file": input_file_id}, separators=(",", ":")).encode()
    headers = signed_request_headers(
        method="POST",
        target="/internal/tasks/resolve",
        body=body,
        job_id=UUID("00000000-0000-0000-0000-000000000015"),
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/resolve", headers=headers, content=body)

    assert response.status_code == 200
    assert response.json()["value"] == {"message": input_file_id}


def test_signed_rest_preserves_result_aliases_through_authoritative_validation() -> None:
    app = build_task_server(
        name="alias",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo an aliased Result.",
                params_model=EchoParams,
                result_model=AliasedResult,
                adapter=AliasedResultAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    body, headers = _signed_json(
        {"text": "hello"},
        "00000000-0000-0000-0000-000000000016",
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 200
    assert response.json()["value"] == {"wire_message": "hello"}


def test_signed_rest_rejects_a_result_with_the_wrong_model_class() -> None:
    app = build_task_server(
        name="result",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Reject a wrong Result model class.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=WrongResultClassAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    body, headers = _signed_json(
        {"text": "hello"},
        "00000000-0000-0000-0000-000000000017",
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 500
    assert response.json()["type"] == "urn:taskome:error:compute_failed"


def test_signed_rest_rejects_a_result_model_subclass() -> None:
    app = build_task_server(
        name="result",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Reject a Result subclass.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=ResultSubclassAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    body, headers = _signed_json(
        {"text": "hello"},
        "00000000-0000-0000-0000-000000000025",
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 500
    assert response.json()["type"] == "urn:taskome:error:compute_failed"


def test_signed_rest_classifies_an_invalid_output_name_as_compute_failure() -> None:
    app = build_task_server(
        name="result",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Reject an invalid output name.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=InvalidOutputNameAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    body, headers = _signed_json(
        {"text": "hello"},
        "00000000-0000-0000-0000-000000000026",
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 500
    assert response.json()["type"] == "urn:taskome:error:compute_failed"


def test_cleanup_failure_does_not_replace_a_successful_result(tmp_path: Path) -> None:
    adapter = CleanupFailureAdapter()
    app = build_task_server(
        name="result",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Preserve the primary result.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=adapter,
            ),
        ),
        runtime=fake_runtime(workdir_root=tmp_path),
    )
    body, headers = _signed_json(
        {"text": "hello"},
        "00000000-0000-0000-0000-000000000027",
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 200
    assert response.json()["value"] == {"message": "hello"}
    assert adapter.job_root is not None
    assert adapter.job_root.exists()
    adapter.job_root.chmod(0o700)
    shutil.rmtree(adapter.job_root)


def test_manifest_describes_the_flat_alias_schema() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        response = client.get(
            "/internal/manifest",
            headers=signed_request_headers(method="GET", target="/internal/manifest", body=b""),
        )

    assert response.status_code == 200
    assert response.json()["schema_version"] == 1
    assert response.json()["server_name"] == "echo"
    assert response.json()["tasks"][0]["params_schema"]["properties"] == {
        "text": {"title": "Text", "type": "string"}
    }


def test_rest_rejects_unknown_or_coerced_params() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        body, headers = _signed_json(
            {"text": "hello", "unexpected": True}, "00000000-0000-0000-0000-000000000001"
        )
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"


def test_rest_requires_a_valid_raw_body_signature() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        response = client.post(
            "/internal/tasks/echo",
            headers={"X-Taskome-Job-Id": "00000000-0000-0000-0000-000000000006"},
            json={"text": "hello"},
        )

    assert response.status_code == 401
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json() == {
        "type": "urn:taskome:error:unauthorized",
        "title": "unauthorized",
        "status": 401,
        "detail": "Invalid Gateway request.",
    }


def test_rest_rejects_a_signed_but_non_uuid_job_id() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    body = b'{"text":"hello"}'
    headers = signed_request_headers(method="POST", target="/internal/tasks/echo", body=body)
    headers["X-Taskome-Job-Id"] = "not-a-uuid"
    headers["content-type"] = "application/json"

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 401


def test_rest_rejects_an_oversized_raw_body_before_json_parsing() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(request_body_max_bytes=10),
    )
    body, headers = _signed_json({"text": "too large"}, "00000000-0000-0000-0000-000000000008")

    with TestClient(app) as client:
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 413


def test_rest_rejects_a_recently_completed_job_id() -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=EchoAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )
    body, headers = _signed_json({"text": "hello"}, "00000000-0000-0000-0000-000000000007")

    with TestClient(app) as client:
        first = client.post("/internal/tasks/echo", headers=headers, content=body)
        assert first.status_code == 200
        replay = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert replay.status_code == 409
    assert replay.json()["type"] == "urn:taskome:error:duplicate_job"


def test_rest_rejects_unknown_fields_in_nested_params() -> None:
    app = build_task_server(
        name="nested",
        tasks=(
            TaskDefinition(
                name="echo",
                description="Echo a nested message.",
                params_model=NestedParams,
                result_model=EchoResult,
                adapter=NestedAdapter(),
            ),
        ),
        runtime=fake_runtime(),
    )

    with TestClient(app) as client:
        body, headers = _signed_json(
            {"payload": {"text": "hello", "unexpected": True}},
            "00000000-0000-0000-0000-000000000002",
        )
        response = client.post("/internal/tasks/echo", headers=headers, content=body)

    assert response.status_code == 422


def test_rest_publishes_validated_produced_files_and_cleans_the_workdir(tmp_path: Path) -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="write",
                description="Write a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=OutputAdapter(),
            ),
        ),
        runtime=fake_runtime(workdir_root=tmp_path),
    )

    with TestClient(app) as client:
        body = json.dumps({"text": "hello"}, separators=(",", ":")).encode()
        headers = signed_request_headers(
            method="POST",
            target="/internal/tasks/write",
            body=body,
            job_id=UUID("00000000-0000-0000-0000-000000000003"),
        )
        headers["content-type"] = "application/json"
        response = client.post("/internal/tasks/write", headers=headers, content=body)

    assert response.json()["outputs"] == [
        {
            "name": "result",
            "storage_key": "test/result",
            "media_type": "text/plain",
            "download_name": "result.txt",
            "size_bytes": 5,
            "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        }
    ]
    assert not list(tmp_path.iterdir())


def test_rest_rejects_symlinked_produced_files(tmp_path: Path) -> None:
    app = build_task_server(
        name="echo",
        tasks=(
            TaskDefinition(
                name="write",
                description="Write a message.",
                params_model=EchoParams,
                result_model=EchoResult,
                adapter=SymlinkOutputAdapter(),
            ),
        ),
        runtime=fake_runtime(workdir_root=tmp_path),
    )
    body = b'{"text":"hello"}'
    headers = signed_request_headers(
        method="POST",
        target="/internal/tasks/write",
        body=body,
        job_id=UUID("00000000-0000-0000-0000-000000000009"),
    )

    with TestClient(app) as client:
        response = client.post("/internal/tasks/write", headers=headers, content=body)

    assert response.status_code == 500
    assert response.json()["type"] == "urn:taskome:error:compute_failed"
    assert not list(tmp_path.iterdir())
