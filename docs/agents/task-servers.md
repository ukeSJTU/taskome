# Adding and operating a Task Server

Use this checklist when adding `apps/task-<name>`. A Task Server is one independently deployed, flat uv project that may expose multiple Tasks sharing the same compute environment. There is no generator or cookiecutter; the small explicit assembly is the template.

## 1. Choose the server boundary

Group Tasks only when they genuinely share the same compute dependencies, image, credentials, capacity, and deployment lifecycle. Give the server a lowercase single-underscore name of at most 63 characters. Give each local Task a unique name under the same rule.

Do not put independent samples into one Task invocation. One Job carries one Params object for one logical computation. A Task may require several files (for example receptor plus ligand) and may emit several files, but applying it independently to two samples creates two Jobs.

## 2. Create the flat project

```text
apps/task-fpocket/
├── pyproject.toml
├── uv.lock
├── mise.toml
├── Dockerfile
├── .env.example
├── src/fpocket_server/
│   ├── __init__.py
│   ├── app.py
│   └── detect.py
├── tests/
│   ├── unit/
│   └── integration/
└── compute/
```

Never add a nested `server/` Python project. `compute/` contains the editable upstream source or build definition; environment isolation belongs in Docker stages. A subprocess still runs inside the same container, not over a network hop.

The Task Server is deliberately not a root uv workspace member. It owns its dependency resolution and lockfile:

```toml
[project]
name = "fpocket-server"
requires-python = ">=3.14"
dependencies = [
  "pydantic>=2",
  "task-kit",
  # Only dependencies imported by this server's code.
]

[tool.uv.sources]
task-kit = { path = "../../packages/task-kit", editable = true }
```

Do not repeat FastAPI, FastMCP, structlog, boto3, or OTel unless the Task Server imports their APIs directly. Run `uv lock` in the Task Server after dependency or task-kit dependency metadata changes.

## 3. Define each Task

For each local Task:

1. Define one curated strict Params model and one Result model.
2. Use `InputFileId` for uploaded files; never accept a caller path or presigned URL.
3. Implement one ComputeAdapter instance.
4. Return `ComputeResult` with zero or more Produced Files.
5. Use relative output paths beneath `ctx.workdir`.
6. Classify safe semantic rejection as `ComputeInputError` and internal tool failure as `ComputeExecutionError`.
7. Never add `extra_args`, a platform batch envelope, Task version, execution mode, timeout placeholder, storage key, or callback.

The frozen Produced File data shape is:

```python
return ComputeResult(
    value=Result(...),
    outputs=(
        ProducedFile(
            name="predicted_structure",
            relative_path=Path("prediction.pdb"),
            media_type="chemical/x-pdb",
            download_name="prediction.pdb",
        ),
    ),
)
```

Do not use the superseded `files` or `path` field names. The only supported imports are the package-root author API, `task_kit.runtime`, and `task_kit.testing`.

Subprocess adapters pass an argument vector without `shell=True`, use controlled cwd/environment, and close/terminate children they create when their own operation fails. task-kit cannot safely kill an arbitrary worker thread and does not promise a total execution timeout.

## 4. Assemble the app

`src/<name>_server/app.py` contains only settings, runtime, Task definitions, and the factory:

```python
from task_kit import TaskDefinition, build_task_server
from task_kit.runtime import TaskServerSettings, build_runtime

from fpocket_server.detect import DetectAdapter, DetectParams, DetectResult

settings = TaskServerSettings()
runtime = build_runtime(settings)

app = build_task_server(
    name="fpocket",
    tasks=(
        TaskDefinition(
            name="detect",
            description="Detect binding pockets in a protein structure.",
            params_model=DetectParams,
            result_model=DetectResult,
            adapter=DetectAdapter(),
        ),
    ),
    runtime=runtime,
)
```

Do not instantiate FastAPI/FastMCP, add routes, install middleware, configure logging/OTel, or write lifespan code in the Task Server.

## 5. Configure local and production credentials

Copy `.env.example` to the service-local ignored `.env`. Supply:

- Gateway internal URL and a unique 32-byte-or-longer Gateway/Task-Server HMAC secret.
- A unique SeaweedFS access key and secret restricted to `{server_name}/` in the configured bucket.
- Optional workdir root and operational I/O budgets.
- Standard application environment/log level/docs and OTLP variables.

If `WORKDIR_ROOT` is configured, create it before first start and make it writable by the Task Server user. Startup validates it before readiness.

Never give the Task Server access to Gateway's `uploads/` prefix. It retrieves only Job-attached Input Files through Gateway's signed internal resolver and a fresh presigned GET.

Gateway static config must map the exact server name to one internal URL. Gateway startup fetches the signed manifest and refuses readiness if it is unavailable, mismatched, or creates a qualified-name collision.

## 6. Test at the agreed seams

- Adapter unit tests call `adapter.run()` with `task_kit.testing.make_compute_context`; they use the real wrapped tool where practical and assert Result/Produced File behavior.
- Task Server contract tests call the ASGI app over REST and with a real FastMCP client, using `task_kit.testing`'s fake runtime. The same worked example must produce equivalent outcomes through both transports.
- Production task-kit port behavior belongs to task-kit's own HMAC/HTTP/SeaweedFS integration suite, not every Task Server.

Do not mock task-kit private modules, assert internal collaborator calls, or query storage as a side-channel assertion. See [testing.md](testing.md).

## 7. Register repository tasks

Create the Task Server's `mise.toml` with independent `sync`, `build`, `lint`, `format`, `check`, and `test` tasks. Set `VIRTUAL_ENV=false` so uv selects the app-local `.venv` rather than the root workspace environment.

Add the directory to root `mise.toml`'s `[monorepo].config_roots`, then explicitly add its tasks to the relevant root aggregate `depends` lists; config discovery does not update those lists automatically. Update CI jobs when the server adds a new integration tier.

Keep `compute/` excluded from first-party Python lint/type checks when it contains vendored Python. Read-only reference submodules remain under `references/` and are never copied or edited as the app's compute source.

## 8. Build and run

Use the monorepo root as Docker context:

```bash
docker build --file apps/task-fpocket/Dockerfile --tag taskome/task-fpocket:dev .
```

The Dockerfile resolves the compute environment in its own stages, installs the Task Server from its locked uv project plus the local task-kit source, runs as a non-root user, and starts:

```bash
uv run fastapi run --host 0.0.0.0 --port 8000 --workers 1 src/fpocket_server/app.py
```

For synchronous v1, configure exactly one process and one replica. Use stop-then-start deployment; do not put multiple replicas behind a load balancer. Health endpoints are `/health/live` and `/health/ready`; internal Task endpoints are never routed at the public edge.

Forced shutdown can interrupt a Job and leave an ambiguous state or orphan output. There is no automatic retry. A caller retry creates a new Job. Clearly retain the `TODO`/documentation marker that this process-local execution, capacity, duplicate guard, and deployment constraint must be replaced—not extended—when Taskiq/Ray is designed.

REST failures use RFC 9457 Problem Details. MCP execution failures carry a stable `_meta.taskome.error_code`. Inspect structured logs and traces by Job id, but never log Params, sequences, presigned URLs, credentials, signatures, raw tool stderr, or `ComputeExecutionError` text.

## 9. Final checklist

- REST and MCP both expose every local Task through one shared execution core.
- Manifest schemas match authoritative Pydantic behavior and contain no version field beyond `schema_version`.
- Params are curated and represent one logical invocation.
- Input paths and output keys never use caller filenames.
- Output names are stable, unique, and lowercase snake case.
- HMAC and SeaweedFS credentials are unique to the server.
- `workers=1`, `replicas=1`, and no outer timeout are visible in operations docs.
- Unit, contract, and required integration tests pass from the app's own lockfile.
- Root mise aggregates and CI actually invoke the new checks.
