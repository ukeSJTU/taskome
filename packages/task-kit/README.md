# task-kit

`task-kit` is Taskome's typed shared implementation for building internal Task Servers. A Task author supplies curated Pydantic Params/Result models and a synchronous ComputeAdapter; task-kit owns strict validation, FastAPI and FastMCP exposure, signed Gateway requests, Input File materialization, output publication, workdir cleanup, errors, logging, traces, health, and application lifespan.

## Author-facing API

Normal Task code imports only from the package root:

```python
from task_kit import (
    ComputeAdapter,
    ComputeContext,
    ComputeError,
    ComputeExecutionError,
    ComputeInputError,
    ComputeResult,
    InputFileId,
    ProducedFile,
    TaskDefinition,
    TaskServerRuntime,
    build_task_server,
)
```

Infrastructure assembly additionally imports:

```python
from task_kit.runtime import TaskServerSettings, build_runtime
```

`task_kit.testing` is the only supported test-helper module. Every underscore-prefixed module is private.

## Minimal server with two Tasks

A Task Server can expose any number of Tasks that share one compute environment. Local names are unique within the server:

```python
# src/fpocket_server/app.py
from pathlib import Path

from pydantic import BaseModel

from task_kit import (
    ComputeAdapter,
    ComputeContext,
    ComputeResult,
    InputFileId,
    ProducedFile,
    TaskDefinition,
    build_task_server,
)
from task_kit.runtime import TaskServerSettings, build_runtime


class DetectParams(BaseModel):
    structure: InputFileId


class DetectValue(BaseModel):
    pocket_count: int


class DetectAdapter(ComputeAdapter[DetectParams, DetectValue]):
    def run(
        self,
        params: DetectParams,
        ctx: ComputeContext,
    ) -> ComputeResult[DetectValue]:
        source = ctx.input_path(params.structure)
        output = ctx.workdir / "ranked.pdb"
        # Run the real compute tool with source and write output here.
        output.write_bytes(source.read_bytes())
        return ComputeResult(
            value=DetectValue(pocket_count=1),
            outputs=(
                ProducedFile(
                    name="ranked_structure",
                    relative_path=Path("ranked.pdb"),
                    media_type="chemical/x-pdb",
                    download_name="ranked.pdb",
                ),
            ),
        )


class ScoreParams(BaseModel):
    structure: InputFileId


class ScoreValue(BaseModel):
    score: float


class ScoreAdapter(ComputeAdapter[ScoreParams, ScoreValue]):
    def run(
        self,
        params: ScoreParams,
        ctx: ComputeContext,
    ) -> ComputeResult[ScoreValue]:
        source = ctx.input_path(params.structure)
        ctx.logger.info("scoring_structure", size_bytes=source.stat().st_size)
        return ComputeResult(value=ScoreValue(score=0.42))


settings = TaskServerSettings()
runtime = build_runtime(settings)

app = build_task_server(
    name="fpocket",
    tasks=(
        TaskDefinition(
            name="detect",
            description="Detect binding pockets in a protein structure.",
            params_model=DetectParams,
            result_model=DetectValue,
            adapter=DetectAdapter(),
        ),
        TaskDefinition(
            name="score",
            description="Score a protein structure with fpocket.",
            params_model=ScoreParams,
            result_model=ScoreValue,
            adapter=ScoreAdapter(),
        ),
    ),
    runtime=runtime,
)
```

The example file copy is illustrative, not recommended adapter I/O. Real subprocess adapters must pass argument lists without a shell, capture bounded diagnostics, classify known tool rejection as `ComputeInputError`, and wrap tool/environment failure in `ComputeExecutionError`.

Task models do not need to repeat `ConfigDict(strict=True, extra="forbid")`. task-kit applies that policy authoritatively and exposes the matching flat JSON Schema through REST, MCP, and the manifest. Params remain a curated domain contract; do not expose `extra_args` or another raw CLI passthrough.

## One Job is one invocation

One Job carries one complete Params object for one Task call. Params can contain multiple Input File ids when they form one logical input, such as receptor plus ligand. A Job can return multiple Produced Files.

There is no platform batch envelope. Converting PDB-A and PDB-B independently is two Jobs, even if the same Task handles both. A list field is appropriate only when the algorithm jointly consumes the collection in one computation.

## ComputeContext and files

For each call, task-kit creates an isolated directory with separate `inputs/` and `work/` children. `ComputeContext.workdir` points to `work/`; `input_path(id)` returns the controlled local path of a materialized Input File. An adapter may ignore the context if it is pure in-process compute.

Produced File paths are relative to `workdir`. task-kit rejects absolute paths, parent traversal, missing paths, directories, symlinks that escape the workdir, and duplicate output names. It computes size and SHA-256, uploads all files beneath `{server_name}/{job_id}/{output_name}`, and removes the whole Job directory in `finally`. `download_name` is display-only and never controls a local path or storage key.

The adapter always returns `ComputeResult(value=...)`, including when it has no files. Do not return a bare Result model, raw bytes, base64 content, local path, object key, or presigned URL. Do not use the superseded `files` or `path` field names.

## Errors

- Raise `ComputeInputError("safe message")` when validated Params are semantically rejected by the wrapped tool. Its message can reach the caller.
- Raise `ComputeExecutionError("internal diagnostic")` for subprocess, environment, or tool failure. Its text is neither returned nor exported to telemetry; task-kit logs only a safe failure classification.
- Let Pydantic reject malformed Params before compute.
- task-kit owns Input File download errors, output publishing errors, invalid adapter return values, and cleanup logging.

REST uses RFC 9457 Problem Details. MCP uses JSON-RPC `InvalidParams` for model validation and `isError=true` with `_meta.taskome.error_code` for execution errors. REST and MCP execute the same core and publish the same success value/output metadata.

## Internal interfaces

| Route                              | Authentication                               | Purpose                               |
| ---------------------------------- | -------------------------------------------- | ------------------------------------- |
| `GET /health/live`                 | none                                         | process liveness                      |
| `GET /health/ready`                | none                                         | completed startup and accepting work |
| `GET /internal/manifest`           | Gateway HMAC, no Job id                      | immutable Task catalog                |
| `POST /internal/tasks/{task_name}` | Gateway HMAC + Job id                        | REST execution                        |
| `/mcp/`                            | tool discovery unsigned; `tools/call` signed | FastMCP Streamable HTTP               |
| `GET /docs`                        | none, development only by default            | Scalar REST reference                 |

Successful REST and MCP calls return `value` plus `outputs`. Every output has `name`, `storage_key`, `media_type`, nullable `download_name`, `size_bytes`, and `sha256`. REST failures use RFC 9457 Problem Details: invalid input 422, compute failure 500, Input File/output infrastructure failure 502, duplicate Job 409, oversized body 413, and invalid authentication 401. MCP model errors are JSON-RPC `InvalidParams`; execution errors use `isError=true` and `_meta.taskome.error_code`.

Execution, manifest, and Gateway-to-Task-Server MCP calls use ADR-0027's signed HTTP protocol. Health endpoints are unsigned. Task Server interfaces are internal; callers use Gateway's public `/v1` REST or `/mcp` interface.

The manifest reports `schema_version`, `server_name`, and each Task's local name, description, Params schema, and Result schema. It contains no Task version or build revision.

## Testing

For adapter and app tests, use the supported `task_kit.testing.fake_runtime()` external-boundary fake. Enter the app through signed REST or a real FastMCP client; do not import private runtime implementation modules.

Run the package gates from the repository root:

```bash
mise run //packages/task-kit:check
mise run //packages/task-kit:test:unit
mise run //packages/task-kit:test:integration
```

The integration suite starts a fake HTTP Gateway and pinned SeaweedFS 3.93 container; Docker must be available.

## Configuration

`TaskServerSettings` reads `.env`, is case-insensitive, ignores unrelated variables, and fails fast when required credentials are absent.

Required settings are `GATEWAY_INTERNAL_URL`, a distinct 32+ byte `GATEWAY_TASK_HMAC_SECRET`, `SEAWEEDFS_INTERNAL_ENDPOINT`, `SEAWEEDFS_ACCESS_KEY`, and `SEAWEEDFS_SECRET_KEY`. The SeaweedFS identity must be restricted to the server's `{server_name}/` output prefix.

| Setting                                                              | Default                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `APP_ENVIRONMENT`                                                    | `development`                                                                   |
| `LOG_LEVEL`                                                          | `info`                                                                          |
| `DOCS_ENABLED`                                                       | enabled only in development                                                     |
| `SEAWEEDFS_BUCKET`                                                   | `taskome`                                                                       |
| `HTTP_CONNECT_TIMEOUT_SECONDS` / `HTTP_IO_TIMEOUT_SECONDS`           | `3` / `30`                                                                      |
| `SEAWEEDFS_CONNECT_TIMEOUT_SECONDS` / `SEAWEEDFS_IO_TIMEOUT_SECONDS` | `3` / `30`                                                                      |
| `GATEWAY_SIGNATURE_MAX_AGE_SECONDS`                                  | `300`                                                                           |
| `WORKDIR_ROOT`                                                       | system temporary directory; configured paths must already exist and be writable |
| `MAX_CONCURRENT_JOBS`                                                | `1`                                                                             |
| `REQUEST_BODY_MAX_BYTES` / `MCP_MESSAGE_MAX_BYTES`                   | `4194304` / `1048576`                                                           |
| `OTEL_SERVICE_NAME`                                                  | server name                                                                     |
| standard OTLP endpoint/header settings                               | unset                                                                           |

Never reuse a Task Server's HMAC or SeaweedFS credential for another server.

## Run and operations

Task Servers are independent uv projects with their own lockfile and a relative task-kit source:

```toml
[project]
dependencies = ["pydantic>=2", "task-kit"]

[tool.uv.sources]
task-kit = { path = "../../packages/task-kit", editable = true }
```

Use the monorepo root as Docker build context so that both the app and task-kit are available:

```bash
uv run fastapi dev src/fpocket_server/app.py
uv run fastapi run --workers 1 src/fpocket_server/app.py
```

The synchronous version requires exactly one worker and one replica. It has no durable queue, total execution timeout, automatic retry, rolling overlap, or cross-restart exactly-once guarantee. Normal shutdown waits for admitted work. These constraints are intentional until Taskiq and Ray are designed together.

Gateway owns Job identity and state; Task Servers never expose caller-facing URLs, authentication, or CORS. Output PUTs request the S3 `If-None-Match: *` condition. Because the pinned SeaweedFS 3.93 does not enforce that condition, publication also checks object existence immediately before writing; the one-process, one-replica, stop-then-start contract is what makes this compatible non-overwriting boundary safe in synchronous v1.

See [ADR-0026](../../docs/adr/0026-task-kit-public-api-and-sync-execution.md), [ADR-0027](../../docs/adr/0027-gateway-owned-job-dispatch-and-task-manifests.md), and the [Task Server runbook](../../docs/agents/task-servers.md).
