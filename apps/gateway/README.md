# Taskome Gateway

`apps/gateway` is Taskome's computing-platform backend. It owns business APIs and
job state, and exposes the same platform capabilities through REST and MCP. Browser
clients reach it through the `apps/web` BFF; authentication remains owned by
`apps/web`.

## Run locally

From the repository root:

```bash
cp apps/gateway/.env.example apps/gateway/.env
uv sync
mise run //apps/gateway:dev
```

The gateway listens on `http://127.0.0.1:8000`. In development, the Scalar API
reference is at `/scalar` and its OpenAPI schema is at `/openapi.json`; the MCP
Streamable HTTP transport is mounted at `/mcp`.

For a production-style process, use `mise run //apps/gateway:start`. Production
mode emits JSON logs, enables HSTS headers, and disables Scalar and OpenAPI unless
`DOCS_ENABLED=true` is set explicitly. TLS termination is expected at the reverse
proxy. Swagger UI and ReDoc are disabled in every environment.

## Interfaces

- `/v1` — versioned business REST API namespace
- `/mcp` — MCP Streamable HTTP transport
- `/internal` — reserved internal API namespace
- `/health/live` — process liveness
- `/health/ready` — dependency readiness

The MCP server exposes the Task-agnostic `prepare_input_file_upload` and
`prepare_input_file_download` tools. They return short-lived presigned
SeaweedFS URLs, with the upload tool also returning a new Input File id; callers
transfer bytes directly to or from SeaweedFS. The REST equivalent is
`POST /v1/input-files`, with presigned download and delete endpoints under
`/v1/input-files/{id}`. REST accepts Web BFF session JWTs bound to the public
`/v1` resource; MCP accepts OAuth access tokens bound to the public `/mcp`
resource. `GET /v1/me` reports the normalized Principal identity for REST calls.

Upload callers must send `If-None-Match: *` with the PUT request. The condition
is signed into the URL so an Input File's object cannot be overwritten after its
first successful upload.

## Configuration

Application-local settings use `APP_ENVIRONMENT`, `LOG_LEVEL`, and `DOCS_ENABLED`.
`DATABASE_URL` is required and uses the explicit `postgresql+psycopg` dialect.
SeaweedFS uses `SEAWEEDFS_INTERNAL_ENDPOINT` for gateway calls and
`SEAWEEDFS_PUBLIC_ENDPOINT` for caller-facing presigned URLs; the public endpoint
defaults to the internal endpoint. See `.env.example` for the full storage and
authentication settings. Gateway derives the session issuer and OAuth issuer from
`BETTER_AUTH_URL`, its internal JWKS URL from `WEB_INTERNAL_URL`, and the REST and
MCP resources from `GATEWAY_PUBLIC_URL`.
Gateway owns only the `gateway` schema; Web/Auth's Drizzle-managed tables remain in
`public`.
OpenTelemetry keeps its standard `OTEL_*` names; setting
`OTEL_EXPORTER_OTLP_ENDPOINT` enables OTLP/HTTP traces and logs. See
`.env.example` for the local template.

## Development checks

```bash
mise run //apps/gateway:test
mise run //apps/gateway:check
```

Start the supporting PostgreSQL service with `mise run dev:up`, change a model, then
generate a reviewed revision with `mise run //apps/gateway:db:revision`; it uses a
disposable PostgreSQL 18 container and creates no revision when metadata matches the
existing head. Apply revisions with `mise run //apps/gateway:db:migrate` — this is
the only path that builds the schema, in development, tests, and production alike
(see ADR-0024); the production Compose stack runs `db:migrate` once before Gateway
starts. Native development uses `localhost` in the URL; containers use the `postgres`
host. Liveness is process-only; readiness makes a short, live database check and
returns only `database: ok` or `database: error`.

The source tree separates transport (`api`), operational concerns (`core`),
contracts (`schemas`), persistence (`models` and `repositories`), and business
orchestration (`services`).
