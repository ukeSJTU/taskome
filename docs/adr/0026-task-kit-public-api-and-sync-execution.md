---
status: accepted
---

# task-kit owns the complete synchronous Task Server execution boundary

ADR-0016 decided that `packages/task-kit` must be a real shared implementation rather than a bare interface. This ADR freezes that implementation's author-facing API and synchronous execution contract. It supersedes ADR-0017: there is no `register_task`, `RunContext`, Task timeout, `ComputeTimeoutError`, or inline base64 output.

## Public API

Normal Task authors import only from `task_kit`:

```python
ParamsT = TypeVar("ParamsT", bound=BaseModel)
ResultT = TypeVar("ResultT", bound=BaseModel)


class ComputeAdapter(Protocol[ParamsT, ResultT]):
    def run(
        self,
        params: ParamsT,
        ctx: ComputeContext,
    ) -> ComputeResult[ResultT]: ...


@dataclass(frozen=True, slots=True)
class ComputeContext:
    workdir: Path
    logger: structlog.stdlib.BoundLogger

    def input_path(self, input_file_id: InputFileId) -> Path: ...


class InputFileId(RootModel[UUID]):
    model_config = ConfigDict(frozen=True)


@dataclass(frozen=True, slots=True)
class ProducedFile:
    name: str
    relative_path: Path
    media_type: str
    download_name: str | None = None


@dataclass(frozen=True, slots=True)
class ComputeResult(Generic[ResultT]):
    value: ResultT
    outputs: tuple[ProducedFile, ...] = ()


@dataclass(frozen=True, slots=True)
class TaskDefinition(Generic[ParamsT, ResultT]):
    name: str
    description: str
    params_model: type[ParamsT]
    result_model: type[ResultT]
    adapter: ComputeAdapter[ParamsT, ResultT]


def build_task_server(
    *,
    name: str,
    tasks: Sequence[TaskDefinition[Any, Any]],
    runtime: TaskServerRuntime,
) -> FastAPI: ...
```

The root package exports only `ComputeAdapter`, `ComputeContext`, `ComputeError`, `ComputeExecutionError`, `ComputeInputError`, `ComputeResult`, `InputFileId`, `ProducedFile`, `TaskDefinition`, `TaskServerRuntime`, and `build_task_server`. `task_kit.runtime` is the supported infrastructure entry point for `TaskServerSettings`, `build_runtime`, the runtime ports, and their transport DTOs. `task_kit.testing` is the supported testing entry point for constructing a `ComputeContext` and a fake runtime without reaching into private modules. Every other module begins with an underscore; `py.typed` marks the supported API as inline typed.

`TaskDefinition` accepts one adapter instance, not an adapter class, factory, or bare callable. Its description is explicit and required. The factory copies the supplied sequence to a tuple, requires at least one Task, validates the whole registry, generates all schemas, and then freezes it. Server names, local Task names, and Produced File names use lowercase alphanumeric snake case with single underscores and a maximum of 63 characters. Local Task names and Produced File names are unique in their respective registry/result. Params and Result types must be Pydantic `BaseModel` subclasses whose schemas generate successfully.

A Task Server may register multiple Tasks that share the same compute environment. Local Task names need be unique only within that server. task-kit does not define a platform namespace or parse Gateway-qualified names.

## One invocation, not a batch

One Job is one invocation of one Task with one complete Params object. Params may contain zero, one, or several Input File ids when those values jointly form one logical compute input, and one result may contain several output files. task-kit deliberately has no outer `batch`, `items`, `map`, or `list[ParamsT]` invocation envelope. Running the same operation independently for two structures creates two Jobs. A curated Task may contain a list field only when the algorithm semantically consumes the collection as one computation.

## Validation and schemas

The Params model drives one flat top-level schema for REST and MCP; FastMCP's nested single-model-argument shape is not used. task-kit performs authoritative validation itself with `strict=True`, `extra="forbid"`, aliases enabled, and field names disabled. The override is recursive, so Task authors need not repeat a `ConfigDict` in every nested model. Manifest JSON Schema uses aliases and adds `additionalProperties: false` to object schemas with declared properties while preserving typed dictionary `additionalProperties` schemas. Custom Pydantic validators are allowed: Gateway can prevalidate JSON-Schema-expressible constraints, but Task Server Pydantic validation remains authoritative.

Result values are required even when there are no files. task-kit verifies that the adapter returned a `ComputeResult`, revalidates its value against the declared Result model through JSON serialization, and always emits `value` plus `outputs`. Incorrect result types, duplicate output names, and invalid Produced Files are adapter programming errors.

## Runtime ports and assembly

Production apps assemble an explicit runtime rather than relying on environment lookups from a global or a God port:

```python
settings = TaskServerSettings()
runtime = build_runtime(settings)
app = build_task_server(name="fpocket", tasks=(...), runtime=runtime)
```

`TaskServerRuntime` contains three independent ports: `GatewayRequestVerifier`, `InputFileResolver`, and `OutputPublisher`, plus the process logger, optional workdir root, and process-local concurrency state. `build_runtime` creates the production implementations from settings; application lifespan starts and closes reusable HTTP, S3, logging, and OpenTelemetry resources. Test fakes have no-op lifecycle. A runtime is explicitly passed to the factory and cannot be absent.

The secondary `task_kit.runtime` contract is structural and exact:

```python
@dataclass(frozen=True, slots=True)
class SignedGatewayRequest:
    timestamp: str | None
    signature: str | None
    method: str
    target: str  # raw path plus query
    body: bytes
    job_id: str | None
    traceparent: str | None


@dataclass(frozen=True, slots=True)
class VerifiedGatewayRequest:
    job_id: UUID | None
    traceparent: str | None


class GatewayRequestVerifier(Protocol):
    def verify(self, request: SignedGatewayRequest) -> VerifiedGatewayRequest: ...


class InputFileResolver(Protocol):
    async def materialize(
        self,
        job_id: UUID,
        input_file_ids: Collection[InputFileId],
        destination_dir: Path,
    ) -> Mapping[InputFileId, Path]: ...


@dataclass(frozen=True, slots=True)
class ValidatedProducedFile:
    name: str
    path: Path
    media_type: str
    download_name: str | None
    size_bytes: int
    sha256: str


@dataclass(frozen=True, slots=True)
class PublishedOutput:
    name: str
    storage_key: str
    media_type: str
    download_name: str | None
    size_bytes: int
    sha256: str


class OutputPublisher(Protocol):
    async def publish(
        self,
        server_name: str,
        job_id: UUID,
        files: Collection[ValidatedProducedFile],
    ) -> tuple[PublishedOutput, ...]: ...


@dataclass(frozen=True, slots=True)
class TaskServerRuntime:
    gateway_requests: GatewayRequestVerifier
    input_files: InputFileResolver
    outputs: OutputPublisher
    logger: structlog.stdlib.BoundLogger
    workdir_root: Path | None = None
```

`SignedGatewayRequest.job_id` stays raw until after signature verification so canonicalization cannot normalize attacker-controlled text before HMAC comparison. `OutputPublisher.publish` owns conditional writes and all-or-none best-effort rollback. The execution core, not the publisher, creates `ValidatedProducedFile` after workdir containment checks.

Settings use `pydantic-settings`, load a local `.env`, ignore unknown keys, and fail fast for required values. They cover application environment/log level/docs exposure; Gateway internal URL and a Task-Server-specific HMAC secret; Task-Server-scoped SeaweedFS endpoint, bucket, and credentials; HTTP/S3 connect and I/O budgets; a 300-second signature window; optional workdir root; `max_concurrent_jobs` defaulting to one; 4 MiB REST and 1 MiB MCP body limits; and optional standard OTLP endpoints and headers. Server name, Task version, execution mode, and total execution timeout are not settings.

```python
class TaskServerSettings(BaseSettings):
    app_environment: Environment = Environment.DEVELOPMENT
    log_level: LogLevel = LogLevel.INFO
    docs_enabled: bool | None = None

    gateway_internal_url: AnyHttpUrl
    gateway_task_hmac_secret: SecretStr
    seaweedfs_internal_endpoint: AnyHttpUrl
    seaweedfs_access_key: str
    seaweedfs_secret_key: SecretStr
    seaweedfs_bucket: str = "taskome"

    http_connect_timeout_seconds: float = 3
    http_io_timeout_seconds: float = 30
    seaweedfs_connect_timeout_seconds: float = 3
    seaweedfs_io_timeout_seconds: float = 30
    gateway_signature_max_age_seconds: int = 300
    workdir_root: Path | None = None
    max_concurrent_jobs: int = 1
    request_body_max_bytes: int = 4 * 1024 * 1024
    mcp_message_max_bytes: int = 1024 * 1024

    otel_service_name: str | None = None
    otel_exporter_otlp_endpoint: str | None = None
    otel_exporter_otlp_traces_endpoint: str | None = None
    otel_exporter_otlp_logs_endpoint: str | None = None
    otel_exporter_otlp_headers: str | None = None
    otel_exporter_otlp_traces_headers: str | None = None
    otel_exporter_otlp_logs_headers: str | None = None
```

## Execution pipeline

Every valid REST or MCP call uses the same internal execution core:

1. Enforce the transport body limit and authenticate the signed Gateway request.
2. Resolve the immutable local Task definition and reject a duplicate Job id.
3. Authoritatively validate the flat Params object.
4. Wait for the shared process-local capacity limiter.
5. Create a per-Job `TemporaryDirectory` with mode `0700`, containing sibling `inputs/` and `work/` directories.
6. Recursively discover InputFileId values in model fields and nested list, tuple, and dictionary values, de-duplicate them in first-occurrence order, and materialize them beneath `inputs/` using controlled UUID names.
7. Construct a ComputeContext whose `workdir` is `work/`, whose logger is bound to server, Task, Job, and trace context, and whose `input_path()` reads the immutable id-to-path map.
8. Run the synchronous adapter in a worker thread under the process-local capacity limiter.
9. Revalidate the Result and all Produced Files, calculate file size and SHA-256, publish every file, and return an internal success envelope.
10. Remove the whole Job directory in `finally`; cleanup failure is logged without replacing the primary outcome.

Input discovery describes files needed by one logical invocation, not batch execution. Materialization is sequential and streaming: each file is written to `.part`, checked against the Gateway-declared exact byte count, and atomically renamed. Output handling first validates every relative path and regular file, rejects absolute paths, `..`, missing files, directories, and symlink escape, and then computes metadata. Uploads proceed in declared order using conditional no-overwrite writes. If one upload fails, the publisher best-effort deletes already uploaded objects in reverse order and reports `output_publish_failed`; orphan garbage collection remains deferred.

The local workdir and upload keys never contain caller-supplied filenames. A Produced File's `download_name` is display-only. Output keys are deterministic `{server_name}/{job_id}/{output_name}`, with each Task Server's SeaweedFS credential restricted to its own server prefix. A published output carries logical name, raw storage key, media type, nullable download name, exact size, and lowercase hexadecimal SHA-256. task-kit never generates a caller-visible download URL.

## Errors and transport projections

The adapter exception hierarchy is deliberately small:

- `ComputeInputError`: the Pydantic model was valid but compute rejected the request; its message is safe for callers.
- `ComputeExecutionError`: the tool, subprocess, or compute environment failed; its message is internal-only.
- `ComputeError`: their common base.

There is no `ComputeTimeoutError` in the synchronous version. Schema failures happen before compute. Input materialization, output publishing, and task-kit bugs are classified by the execution core rather than exposed as adapter errors.

The shared core returns a discriminated success or failure outcome; transports project it separately. REST returns RFC 9457 Problem Details: invalid input is 422, compute failure is 500, and input/output infrastructure failure is 502. Unexpected details, paths, arguments, stderr, signatures, secrets, and presigned URLs are never returned. MCP argument validation is JSON-RPC `InvalidParams`; execution failures return `isError=true`, safe text content, no structured success content, and an internal `_meta.taskome.error_code`. Stable execution codes are `invalid_input`, `compute_failed`, `input_materialization_failed`, and `output_publish_failed`.

On success, REST 200 and MCP `structuredContent` share this internal envelope:

```json
{
    "value": {},
    "outputs": [
        {
            "name": "predicted_structure",
            "storage_key": "fpocket/00000000-0000-0000-0000-000000000000/predicted_structure",
            "media_type": "chemical/x-pdb",
            "download_name": "result.pdb",
            "size_bytes": 12345,
            "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        }
    ]
}
```

Both fields are always present and `download_name` is serialized as null when absent. MCP also includes a JSON text content block for clients that do not consume structured content.

## Routes, lifecycle, and synchronous limits

The factory owns `POST /internal/tasks/{local_task_name}`, signed `GET /internal/manifest`, FastMCP Streamable HTTP at `/mcp`, unsigned `/health/live`, and unsigned `/health/ready`. It owns FastAPI lifespan, developer docs exposure, request limits, structured logging, and OTel trace extraction/propagation. Health checks never probe Gateway or SeaweedFS and do not become unready merely because the concurrency slot is busy. Production exposes no CORS and disables docs by default.

All ComputeAdapters remain synchronous. task-kit dispatches them to worker threads so they cannot block the ASGI event loop, but Python cannot safely kill an arbitrary running thread. Once admitted, the download/compute/upload/cleanup pipeline is shielded from client cancellation. There is no outer total timeout; an adapter may independently use a subprocess watchdog, but that is not part of the task-kit contract. Normal shutdown stops accepting work and waits for in-flight execution; forced process loss can leave an ambiguous Job or orphan object.

The first version requires exactly one process worker and one deployment replica for each Task Server. Its capacity limiter and duplicate guard are process-local. An async lock atomically moves a Job id into the active set before it waits for capacity; completed ids enter a bounded 10,000-entry LRU. Replays in either set return `duplicate_job` (REST 409 or MCP `isError=true`). This is an explicitly temporary synchronous defense, not exactly-once execution. Taskiq/Ray adoption removes the in-process queue, limiter, and LRU and replaces them with durable dispatch plus a persistent Job claim; that design will separately address timeout, cancellation, retries, capacity, rolling deployment, and recovery.

## Package and test shape

The typed package uses `src/task_kit`, public `__init__.py`, `runtime.py`, and `testing.py`, and flat underscore-prefixed private modules for contracts, server assembly, registry, execution, security, files, REST, MCP, and observability. It exposes no FastMCP, httpx, boto3, or OTel type in the root API. FastMCP remains exactly pinned while its 4.0 API is beta; contract tests lock down flat parameter schemas, InvalidParams, `isError`, and structured output before any upgrade.

Its direct runtime dependencies are AnyIO, boto3, `fastapi[standard]`, exactly pinned FastMCP 4.0 beta, httpx, Pydantic, pydantic-settings, scalar-fastapi, structlog, the OpenTelemetry SDK/exporter, and FastAPI/httpx/logging instrumentation. Mature packages use bounded major-version ranges consistent with Gateway; no framework or infrastructure type leaks into the root author API. Gateway and task-kit do not yet extract a smaller shared storage or observability package because their credentials, ownership, and lifecycle differ.

Tests exercise only three agreed seams: adapters directly through `ComputeAdapter.run`; Task Server behavior through the ASGI app and real FastMCP client with a fake runtime; and production HTTP/HMAC/S3 ports against external test boundaries. Private modules are not test seams. Task Servers consume task-kit as an editable relative uv source while no internal package registry exists, keep their own lockfiles, and build from the monorepo root context.

Issue #22's first implementation changes task-kit and its documentation, verifies the Gateway-facing HTTP contract with a fake Gateway plus real S3-compatible integration boundary, and replaces the scaffold test with pytest. It does not implement Gateway's Job model/provider/resolve endpoint and does not modify the first fpocket consumer; those are separate delivery slices built against this contract. The absence of those consumers does not turn the production runtime into a stub: its HTTP and S3 ports perform the real protocol described here.
