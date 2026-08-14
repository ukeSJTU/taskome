"""FastAPI assembly and the single synchronous Task execution pipeline."""
# ruff: noqa: ANN202, ANN401, C901, EM101, EM102, PGH003, PLR0911, PLR0912, PLR0913, PLR0915, PLR0917, PLR2004, PTH101, TC003, TRY003, TRY300

from __future__ import annotations

import hashlib
import inspect
import json
import os
import re
import tempfile
from collections.abc import Iterable
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Any, Union, get_args, get_origin
from uuid import UUID

import anyio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request
from fastmcp.tools.base import ToolResult
from pydantic import BaseModel, ValidationError
from scalar_fastapi import get_scalar_api_reference

from ._middleware import TaskServerBoundaryMiddleware
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


class _InputMaterializationError(Exception):
    pass


class _OutputPublicationError(Exception):
    pass


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


def _reject_nested_extras(value: Any, annotation: Any) -> None:
    """Reject unknown object keys before Pydantic can discard them in nested models."""
    origin = get_origin(annotation)
    if origin is Union:
        for candidate in get_args(annotation):
            try:
                _reject_nested_extras(value, candidate)
                return
            except ValueError:
                continue
        return
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        if not isinstance(value, dict):
            return
        fields = annotation.model_fields
        aliases = {
            field.alias or field_name: (field_name, field) for field_name, field in fields.items()
        }
        unknown = set(value) - set(aliases)
        if unknown:
            raise ValueError("Params contain unknown nested fields")
        for key, child in value.items():
            _, field = aliases[key]
            _reject_nested_extras(child, field.annotation)
        return
    if origin in (list, tuple, set, frozenset) and isinstance(value, list):
        args = get_args(annotation)
        if args:
            for child in value:
                _reject_nested_extras(child, args[0])
    elif origin is dict and isinstance(value, dict):
        args = get_args(annotation)
        if len(args) == 2:
            for child in value.values():
                _reject_nested_extras(child, args[1])


def _validate_params(model: type[BaseModel], payload: Any) -> BaseModel:
    _reject_nested_extras(payload, model)
    return model.model_validate(payload, strict=True, extra="forbid", by_alias=True, by_name=False)


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


async def _bounded_body(request: Request, limit: int) -> bytes:
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise ValueError("request body exceeds configured limit")
    return bytes(body)


def _signed_request(request: Request, body: bytes) -> SignedGatewayRequest:
    return SignedGatewayRequest(
        timestamp=request.headers.get("X-Taskome-Timestamp"),
        signature=request.headers.get("X-Taskome-Signature"),
        method=request.method,
        target=request.url.path + (f"?{request.url.query}" if request.url.query else ""),
        body=body,
        job_id=request.headers.get("X-Taskome-Job-Id"),
        traceparent=request.headers.get("traceparent"),
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
        candidate = root / file.path
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
            with tempfile.TemporaryDirectory(
                prefix=f"{server_name}-{job_id}-", dir=runtime.workdir_root
            ) as directory:
                os.chmod(directory, 0o700)
                root = Path(directory)
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
                    raise ComputeExecutionError(
                        "Adapter returned an invalid result value"
                    ) from error
                files = _validated_outputs(result.files, work)
                try:
                    outputs = await runtime.outputs.publish(server_name, job_id, files)
                except Exception as error:
                    raise _OutputPublicationError from error
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
    mcp = FastMCP(name=f"{name} Task Server")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        async with mcp_app.lifespan(app):
            app.state.ready = True
            runtime.accepting_work = True
            try:
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
    if runtime.instrument is not None:
        runtime.instrument(app)

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
    async def get_manifest(request: Request) -> JSONResponse:
        try:
            runtime.gateway_requests.verify(_signed_request(request, b""))
        except TypeError, ValueError:
            return _problem(401, "unauthorized", "Invalid Gateway request.")
        return JSONResponse(manifest)

    @app.post("/internal/tasks/{local_task_name}")
    async def run_task(local_task_name: str, request: Request) -> JSONResponse:
        definition = registry.get(local_task_name)
        if definition is None:
            return _problem(404, "task_not_found", "Task not found.")
        try:
            body = await _bounded_body(request, runtime.request_body_max_bytes)
        except ValueError:
            return _problem(413, "body_too_large", "Request body is too large.")
        signed = _signed_request(request, body)
        try:
            verified = runtime.gateway_requests.verify(signed)
            job_id = verified.job_id or UUID(signed.job_id or "")
        except ValueError, TypeError:
            return _problem(401, "unauthorized", "Invalid Gateway request.")
        if not await runtime.claim_job(job_id):
            return _problem(409, "duplicate_job", "Job has already been processed.")
        try:
            payload = json.loads(body)
            params = _validate_params(definition.params_model, payload)
        except ValidationError, ValueError:
            await runtime.complete_job(job_id)
            return _problem(422, "invalid_input", "Params do not match this Task's contract.")
        try:
            return JSONResponse(
                await _execute(definition, runtime, name, job_id, params, verified.traceparent)
            )
        except ComputeInputError as error:
            return _problem(422, "invalid_input", str(error))
        except ComputeExecutionError:
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
        async def call_task(**arguments: Any) -> ToolResult:
            request = get_http_request()
            body = await request.body()
            if len(body) > runtime.mcp_message_max_bytes:
                return _mcp_error("invalid_input", "MCP message is too large.")
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
            except TypeError, ValueError:
                return _mcp_error("unauthorized", "Invalid Gateway request.")
            if not await runtime.claim_job(job_id):
                return _mcp_error("duplicate_job", "Job has already been processed.")
            try:
                params = _validate_params(task_definition.params_model, arguments)
                envelope = await _execute(
                    task_definition, runtime, name, job_id, params, verified.traceparent
                )
                return ToolResult(
                    content=json.dumps(envelope, separators=(",", ":")),
                    structured_content=envelope,
                )
            except ValidationError, ValueError, ComputeInputError:
                return _mcp_error("invalid_input", "Params do not match this Task's contract.")
            except ComputeExecutionError:
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
        mcp.tool(
            name=definition.name,
            description=definition.description,
            output_schema={
                "type": "object",
                "required": ["value", "outputs"],
                "properties": {
                    "value": _schema(definition.result_model),
                    "outputs": {"type": "array"},
                },
                "additionalProperties": False,
            },
        )(call_task)
    mcp_app = mcp.http_app(path="/")
    app.mount("/mcp", mcp_app)
    app.add_middleware(TaskServerBoundaryMiddleware, runtime=runtime)

    return app
