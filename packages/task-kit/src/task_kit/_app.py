"""FastAPI assembly and the single synchronous Task execution pipeline."""
# ruff: noqa: ANN202, ANN401, C901, EM101, EM102, PLR0911, PLR0913, PLR0915, PLR0917, PLR2004, PTH101, TC003, TRY003

from __future__ import annotations

import hashlib
import inspect
import json
import os
import re
import shutil
import tempfile
from collections.abc import Awaitable, Callable, Iterable
from contextlib import asynccontextmanager
from dataclasses import asdict
from functools import partial
from pathlib import Path
from typing import Any
from uuid import UUID

import anyio
from anyio import to_thread
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request
from fastmcp.tools.base import Tool, ToolResult
from pydantic import BaseModel, PrivateAttr, ValidationError
from scalar_fastapi import get_scalar_api_reference

from ._middleware import TaskServerBoundaryMiddleware
from ._observability import DeferredTelemetryMiddleware
from ._types import (
    ComputeContext,
    ComputeExecutionError,
    ComputeInputError,
    ComputeResult,
    InputFileId,
    ProducedFile,
    TaskDefinition,
)
from .runtime import TaskServerRuntime, ValidatedProducedFile, VerifiedGatewayRequest

_NAME = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")


class _InputMaterializationError(Exception):
    pass


class _OutputPublicationError(Exception):
    pass


class _TaskTool(Tool):
    _handler: Callable[[dict[str, Any]], Awaitable[ToolResult]] = PrivateAttr()

    def __init__(
        self,
        *,
        definition: TaskDefinition[Any, Any],
        output_schema: dict[str, Any],
        handler: Callable[[dict[str, Any]], Awaitable[ToolResult]],
    ) -> None:
        super().__init__(
            name=definition.name,
            description=definition.description,
            parameters=_mcp_schema(definition.params_model),
            output_schema=output_schema,
        )
        self._handler = handler

    async def run(self, arguments: dict[str, Any]) -> ToolResult:
        return await self._handler(arguments)


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


def _mcp_schema(model: type[BaseModel]) -> dict[str, Any]:
    schema = _schema(model)

    def remove_titles(node: Any) -> None:
        if isinstance(node, dict):
            node.pop("title", None)
            for value in node.values():
                remove_titles(value)
        elif isinstance(node, list):
            for value in node:
                remove_titles(value)

    remove_titles(schema)
    return schema


def _validate_params_json(model: type[BaseModel], body: bytes) -> BaseModel:
    return model.model_validate_json(
        body,
        strict=True,
        extra="forbid",
        by_alias=True,
        by_name=False,
    )


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
    if inspect.isclass(definition.adapter) or not callable(
        getattr(definition.adapter, "run", None)
    ):
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


def _mcp_error(code: str, message: str) -> ToolResult:
    return ToolResult(
        content=message,
        meta={"taskome": {"error_code": code}},
        is_error=True,
    )


def _log_compute_failure(
    runtime: TaskServerRuntime,
    definition: TaskDefinition[Any, Any],
    job_id: UUID,
    error: ComputeExecutionError,
) -> None:
    runtime.logger.error(
        "task_compute_failed",
        failure_type=type(error).__name__,
        task_name=definition.name,
        job_id=str(job_id),
    )


def _log_cleanup_failure(
    runtime: TaskServerRuntime,
    definition: TaskDefinition[Any, Any],
    job_id: UUID,
) -> None:
    runtime.logger.error(
        "task_workdir_cleanup_failed",
        task_name=definition.name,
        job_id=str(job_id),
    )


def _verified_gateway_request(request: Request) -> VerifiedGatewayRequest:
    verified: VerifiedGatewayRequest = request.state.taskome_gateway_request
    return verified


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
        try:
            _assert_name(file.name, "Output name")
        except ValueError as error:
            raise ComputeExecutionError("Adapter returned an invalid output name") from error
        if file.name in names:
            raise ComputeExecutionError("Adapter returned duplicate output names")
        names.add(file.name)
        if file.relative_path.is_absolute() or ".." in file.relative_path.parts:
            raise ComputeExecutionError("Adapter returned an output path outside its workdir")
        candidate = root / file.relative_path
        path = candidate.resolve()
        if candidate.is_symlink() or root not in path.parents or not path.is_file():
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
        with anyio.CancelScope(shield=True):
            directory = Path(
                tempfile.mkdtemp(prefix=f"{server_name}-{job_id}-", dir=runtime.workdir_root)
            )
            try:
                os.chmod(directory, 0o700)
                root = directory
                inputs, work = root / "inputs", root / "work"
                inputs.mkdir()
                work.mkdir()
                try:
                    input_paths = await runtime.input_files.materialize(
                        job_id, _discover_input_files(params), inputs
                    )
                except Exception as error:
                    raise _InputMaterializationError from error
                context = ComputeContext(
                    workdir=work,
                    logger=runtime.logger.bind(
                        server_name=server_name,
                        task_name=definition.name,
                        job_id=str(job_id),
                        traceparent=traceparent,
                    ),
                    _input_paths=input_paths,
                )
                result = await to_thread.run_sync(definition.adapter.run, params, context)
                if not isinstance(result, ComputeResult):
                    raise ComputeExecutionError("Adapter must return ComputeResult")
                if type(result.value) is not definition.result_model:
                    raise ComputeExecutionError("Adapter returned the wrong result model class")
                try:
                    value = definition.result_model.model_validate_json(
                        result.value.model_dump_json(by_alias=True),
                        strict=True,
                        by_alias=True,
                        by_name=False,
                    )
                except (AttributeError, ValidationError) as error:
                    raise ComputeExecutionError(
                        "Adapter returned an invalid result value"
                    ) from error
                files = _validated_outputs(result.outputs, work)
                try:
                    outputs = await runtime.outputs.publish(server_name, job_id, files)
                except Exception as error:
                    raise _OutputPublicationError from error
                return {
                    "value": value.model_dump(mode="json", by_alias=True),
                    "outputs": [asdict(output) for output in outputs],
                }
            finally:
                try:
                    await to_thread.run_sync(partial(shutil.rmtree, directory))
                except OSError:
                    _log_cleanup_failure(runtime, definition, job_id)


def _published_output_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "required": [
            "name",
            "storage_key",
            "media_type",
            "download_name",
            "size_bytes",
            "sha256",
        ],
        "properties": {
            "name": {"type": "string"},
            "storage_key": {"type": "string"},
            "media_type": {"type": "string"},
            "download_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            "size_bytes": {"type": "integer", "minimum": 0},
            "sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
        },
        "additionalProperties": False,
    }


def _verify_workdir_root(root: Path | None, server_name: str) -> None:
    if root is not None and not root.is_dir():
        raise RuntimeError("Configured workdir_root must be an existing directory")
    with tempfile.TemporaryDirectory(prefix=f"{server_name}-startup-", dir=root):
        pass


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
    mcp = FastMCP(name=f"{name} Task Server")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with mcp_app.lifespan(app):
            try:
                await to_thread.run_sync(_verify_workdir_root, runtime.workdir_root, name)
                if runtime.start is not None:
                    await runtime.start(app, name)
                app.state.ready = True
                runtime.accepting_work = True
                yield
            finally:
                app.state.ready = False
                runtime.accepting_work = False
                await runtime.wait_for_active_jobs()
                if runtime.close is not None:
                    await runtime.close()

    app = FastAPI(
        title=f"{name} Task Server",
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.ready = False

    if runtime.docs_enabled:

        @app.get("/docs", include_in_schema=False)
        async def docs() -> object:
            return get_scalar_api_reference(
                openapi_url=app.openapi_url,
                title=f"{name} Task Server API",
                telemetry=False,
            )

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "live"}

    @app.get("/health/ready")
    async def ready(request: Request) -> JSONResponse:
        return JSONResponse(
            {"status": "ready"}, status_code=200 if request.app.state.ready else 503
        )

    @app.get("/internal/manifest")
    async def get_manifest() -> JSONResponse:
        return JSONResponse(manifest)

    @app.post("/internal/tasks/{local_task_name}")
    async def run_task(local_task_name: str, request: Request) -> JSONResponse:
        definition = registry.get(local_task_name)
        if definition is None:
            return _problem(404, "task_not_found", "Task not found.")
        body = await request.body()
        verified = _verified_gateway_request(request)
        job_id = verified.job_id
        if job_id is None:
            return _problem(401, "unauthorized", "Invalid Gateway request.")
        if not await runtime.claim_job(job_id):
            return _problem(409, "duplicate_job", "Job has already been processed.")
        try:
            params = _validate_params_json(definition.params_model, body)
        except ValidationError, ValueError:
            await runtime.complete_job(job_id)
            return _problem(422, "invalid_input", "Params do not match this Task's contract.")
        try:
            return JSONResponse(
                await _execute(definition, runtime, name, job_id, params, verified.traceparent)
            )
        except ComputeInputError as error:
            return _problem(422, "invalid_input", str(error))
        except ComputeExecutionError as error:
            _log_compute_failure(runtime, definition, job_id, error)
            return _problem(500, "compute_failed", "Task execution failed.")
        except _InputMaterializationError:
            return _problem(502, "input_materialization_failed", "Input materialization failed.")
        except _OutputPublicationError:
            return _problem(502, "output_publish_failed", "Output publication failed.")
        except Exception:
            runtime.logger.exception(
                "task_execution_failed", task_name=definition.name, job_id=str(job_id)
            )
            return _problem(502, "input_materialization_failed", "Task infrastructure failed.")
        finally:
            await runtime.complete_job(job_id)

    def mcp_handler(task_definition: TaskDefinition[Any, Any]) -> Any:
        async def call_task(arguments: dict[str, Any]) -> ToolResult:
            request = get_http_request()
            verified = _verified_gateway_request(request)
            job_id = verified.job_id
            if job_id is None:
                return _mcp_error("unauthorized", "Invalid Gateway request.")
            if not await runtime.claim_job(job_id):
                return _mcp_error("duplicate_job", "Job has already been processed.")
            try:
                params = _validate_params_json(
                    task_definition.params_model,
                    json.dumps(arguments, separators=(",", ":")).encode(),
                )
                envelope = await _execute(
                    task_definition, runtime, name, job_id, params, verified.traceparent
                )
                return ToolResult(
                    content=json.dumps(envelope, separators=(",", ":")),
                    structured_content=envelope,
                )
            except ComputeInputError as error:
                return _mcp_error("invalid_input", str(error))
            except ValidationError:
                raise
            except ComputeExecutionError as error:
                _log_compute_failure(runtime, task_definition, job_id, error)
                return _mcp_error("compute_failed", "Task execution failed.")
            except _InputMaterializationError:
                return _mcp_error("input_materialization_failed", "Input materialization failed.")
            except _OutputPublicationError:
                return _mcp_error("output_publish_failed", "Output publication failed.")
            except Exception:
                runtime.logger.exception("task_execution_failed", task_name=task_definition.name)
                return _mcp_error("compute_failed", "Task execution failed.")
            finally:
                await runtime.complete_job(job_id)

        return call_task

    for definition in definitions:
        mcp.add_tool(
            _TaskTool(
                definition=definition,
                handler=mcp_handler(definition),
                output_schema={
                    "type": "object",
                    "required": ["value", "outputs"],
                    "properties": {
                        "value": _schema(definition.result_model),
                        "outputs": {"type": "array", "items": _published_output_schema()},
                    },
                    "additionalProperties": False,
                },
            )
        )
    mcp_app = mcp.http_app(path="/")
    app.mount("/mcp", mcp_app)
    app.add_middleware(TaskServerBoundaryMiddleware, runtime=runtime)
    if runtime.start is not None:
        app.add_middleware(DeferredTelemetryMiddleware, runtime=runtime)

    return app
