"""FastAPI assembly and the single synchronous Task execution pipeline."""
# ruff: noqa: ANN202, ANN401, C901, EM101, EM102, PGH003, PLR0911, PLR0913, PLR0915, PLR0917, PLR2004, PTH101, TC003, TRY003

from __future__ import annotations

import hashlib
import inspect
import os
import re
import tempfile
from collections.abc import Iterable
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Any
from uuid import UUID

import anyio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request
from pydantic import BaseModel, ValidationError

from .runtime import SignedGatewayRequest, TaskServerRuntime, ValidatedProducedFile
from .types import (
    ComputeContext,
    ComputeExecutionError,
    ComputeInputError,
    ComputeResult,
    InputFileId,
    ProducedFile,
    TaskDefinition,
)

_NAME = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")


def _assert_name(value: str, label: str) -> None:
    if len(value) > 63 or not _NAME.fullmatch(value):
        raise ValueError(f"{label} must be lowercase snake case with at most 63 characters")


def _schema(model: type[BaseModel]) -> dict[str, Any]:
    schema = model.model_json_schema(by_alias=True, mode="validation")

    def strict_objects(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" and "properties" in node:
                node["additionalProperties"] = False
            for value in node.values():
                strict_objects(value)
        elif isinstance(node, list):
            for value in node:
                strict_objects(value)

    strict_objects(schema)
    return schema


def _validate_definition(definition: TaskDefinition[Any, Any]) -> None:
    _assert_name(definition.name, "Task name")
    if not definition.description.strip():
        raise ValueError("Task description is required")
    if not isinstance(definition.params_model, type) or not issubclass(
        definition.params_model, BaseModel
    ):
        raise TypeError("params_model must be a Pydantic BaseModel type")
    if not isinstance(definition.result_model, type) or not issubclass(
        definition.result_model, BaseModel
    ):
        raise TypeError("result_model must be a Pydantic BaseModel type")
    if not callable(getattr(definition.adapter, "run", None)):
        raise TypeError("adapter must provide a run(params, ctx) method")
    _schema(definition.params_model)
    _schema(definition.result_model)


def _problem(status: int, code: str, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        media_type="application/problem+json",
        content={
            "type": f"urn:taskome:error:{code}",
            "title": code.replace("_", " "),
            "status": status,
            "detail": detail,
        },
    )


def _discover_input_files(value: Any) -> tuple[InputFileId, ...]:
    found: dict[InputFileId, None] = {}

    def visit(item: Any) -> None:
        if isinstance(item, InputFileId):
            found.setdefault(item, None)
        elif isinstance(item, BaseModel):
            for field in item.__class__.model_fields:
                visit(getattr(item, field))
        elif isinstance(item, (list, tuple, set)):
            for child in item:
                visit(child)
        elif isinstance(item, dict):
            for child in item.values():
                visit(child)

    visit(value)
    return tuple(found)


def _validated_outputs(
    files: Iterable[ProducedFile], workdir: Path
) -> tuple[ValidatedProducedFile, ...]:
    validated: list[ValidatedProducedFile] = []
    names: set[str] = set()
    root = workdir.resolve()
    for file in files:
        _assert_name(file.name, "Output name")
        if file.name in names:
            raise ComputeExecutionError("Adapter returned duplicate output names")
        names.add(file.name)
        if file.path.is_absolute() or ".." in file.path.parts:
            raise ComputeExecutionError("Adapter returned an output path outside its workdir")
        path = (root / file.path).resolve()
        if root not in path.parents or not path.is_file():
            raise ComputeExecutionError("Adapter returned an invalid output file")
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        validated.append(
            ValidatedProducedFile(
                name=file.name,
                path=path,
                media_type=file.media_type,
                download_name=file.download_name,
                size_bytes=path.stat().st_size,
                sha256=digest.hexdigest(),
            )
        )
    return tuple(validated)


async def _execute(
    definition: TaskDefinition[Any, Any],
    runtime: TaskServerRuntime,
    server_name: str,
    job_id: UUID,
    params: BaseModel,
    traceparent: str | None,
) -> dict[str, Any]:
    async with runtime.limiter:
        with tempfile.TemporaryDirectory(
            prefix=f"{server_name}-{job_id}-", dir=runtime.workdir_root
        ) as directory:
            os.chmod(directory, 0o700)
            root = Path(directory)
            inputs, work = root / "inputs", root / "work"
            inputs.mkdir()
            work.mkdir()
            input_paths = await runtime.input_files.materialize(
                job_id, _discover_input_files(params), inputs
            )
            context = ComputeContext(
                workdir=work,
                input_paths=input_paths,
                logger=runtime.logger.bind(
                    server_name=server_name,
                    task_name=definition.name,
                    job_id=str(job_id),
                    traceparent=traceparent,
                ),
            )
            result = await anyio.to_thread.run_sync(  # type: ignore
                definition.adapter.run, params, context
            )
            if not isinstance(result, ComputeResult):
                raise ComputeExecutionError("Adapter must return ComputeResult")
            try:
                value = definition.result_model.model_validate(
                    result.value.model_dump(mode="json"), strict=True
                )
            except (AttributeError, ValidationError) as error:
                raise ComputeExecutionError("Adapter returned an invalid result value") from error
            files = _validated_outputs(result.files, work)
            outputs = await runtime.outputs.publish(server_name, job_id, files)
            return {
                "value": value.model_dump(mode="json", by_alias=True),
                "outputs": [asdict(output) for output in outputs],
            }


def build_task_server(
    *, name: str, tasks: Iterable[TaskDefinition[Any, Any]], runtime: TaskServerRuntime
) -> FastAPI:
    """Build one internal Task Server app from immutable Task definitions and a runtime."""
    _assert_name(name, "Server name")
    definitions = tuple(tasks)
    if not definitions:
        raise ValueError("At least one Task definition is required")
    for definition in definitions:
        _validate_definition(definition)
    registry = {definition.name: definition for definition in definitions}
    if len(registry) != len(definitions):
        raise ValueError("Task names must be unique within a Task Server")
    manifest = {
        "schema_version": 1,
        "server_name": name,
        "tasks": [
            {
                "name": item.name,
                "description": item.description,
                "params_schema": _schema(item.params_model),
                "result_schema": _schema(item.result_model),
            }
            for item in definitions
        ],
    }

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.ready = True
        yield
        app.state.ready = False

    app = FastAPI(title=f"{name} Task Server", docs_url=None, redoc_url=None, lifespan=lifespan)

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "live"}

    @app.get("/health/ready")
    async def ready(request: Request) -> JSONResponse:
        return JSONResponse(
            {"status": "ready"}, status_code=200 if request.app.state.ready else 503
        )

    @app.get("/internal/manifest")
    async def get_manifest() -> dict[str, Any]:
        return manifest

    @app.post("/internal/tasks/{local_task_name}")
    async def run_task(local_task_name: str, request: Request) -> JSONResponse:
        definition = registry.get(local_task_name)
        if definition is None:
            return _problem(404, "task_not_found", "Task not found.")
        body = await request.body()
        signed = SignedGatewayRequest(
            timestamp=request.headers.get("X-Taskome-Timestamp"),
            signature=request.headers.get("X-Taskome-Signature"),
            method=request.method,
            target=request.url.path + (f"?{request.url.query}" if request.url.query else ""),
            body=body,
            job_id=request.headers.get("X-Taskome-Job-Id"),
            traceparent=request.headers.get("traceparent"),
        )
        try:
            verified = runtime.gateway_requests.verify(signed)
            job_id = verified.job_id or UUID(signed.job_id or "")
        except ValueError, TypeError:
            return _problem(401, "unauthorized", "Invalid Gateway request.")
        try:
            payload = await request.json()
            params = definition.params_model.model_validate(
                payload, strict=True, extra="forbid", by_alias=True, by_name=False
            )
        except ValidationError, ValueError:
            return _problem(422, "invalid_input", "Params do not match this Task's contract.")
        try:
            return JSONResponse(
                await _execute(definition, runtime, name, job_id, params, verified.traceparent)
            )
        except ComputeInputError as error:
            return _problem(422, "invalid_input", str(error))
        except ComputeExecutionError:
            return _problem(500, "compute_failed", "Task execution failed.")
        except Exception:
            runtime.logger.exception(
                "task_execution_failed", task_name=definition.name, job_id=str(job_id)
            )
            return _problem(502, "input_materialization_failed", "Task infrastructure failed.")

    mcp = FastMCP(name=f"{name} Task Server")

    def mcp_handler(task_definition: TaskDefinition[Any, Any]) -> Any:
        async def call_task(**arguments: Any) -> dict[str, Any]:
            request = get_http_request()
            signed = SignedGatewayRequest(
                timestamp=request.headers.get("X-Taskome-Timestamp"),
                signature=request.headers.get("X-Taskome-Signature"),
                method=request.method,
                target=request.url.path + (f"?{request.url.query}" if request.url.query else ""),
                body=await request.body(),
                job_id=request.headers.get("X-Taskome-Job-Id"),
                traceparent=request.headers.get("traceparent"),
            )
            verified = runtime.gateway_requests.verify(signed)
            job_id = verified.job_id or UUID(signed.job_id or "")
            params = task_definition.params_model.model_validate(
                arguments, strict=True, extra="forbid", by_alias=True, by_name=False
            )
            return await _execute(
                task_definition, runtime, name, job_id, params, verified.traceparent
            )

        return call_task

    for definition in definitions:
        call_task = mcp_handler(definition)
        fields = []
        for field_name, field_info in definition.params_model.model_fields.items():
            default = inspect.Parameter.empty if field_info.is_required() else field_info.default
            fields.append(
                inspect.Parameter(
                    field_info.alias or field_name,
                    inspect.Parameter.KEYWORD_ONLY,
                    default=default,
                    annotation=field_info.annotation,
                )
            )
        call_task.__annotations__ = {
            field_info.alias or field_name: field_info.annotation
            for field_name, field_info in definition.params_model.model_fields.items()
        }
        call_task.__signature__ = inspect.Signature(fields)  # type: ignore[attr-defined]
        mcp.tool(name=definition.name, description=definition.description)(call_task)
    app.mount("/mcp", mcp.http_app(path="/"))

    return app
