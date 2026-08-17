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

For a production-style process, use `mise run //apps/gateway:start`. Gunicorn
manages four Uvicorn workers by default, gives in-flight requests 30 seconds to
finish on shutdown, and recycles workers after a jittered request budget; all
four values are environment-overridable. Production mode emits JSON logs,
enables HSTS headers, and disables Scalar and OpenAPI unless `DOCS_ENABLED=true`
is set explicitly. TLS termination stays at Caddy. Swagger UI and ReDoc are
disabled in every environment.

The full `/openapi.json` schema remains the development and first-party generated
client source when docs are enabled. The separately generated public Direct API
contract is checked into `apps/docs/openapi.public.json` and published by the
static Docs deployment.

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
`/v1` resource; the official CLI's OAuth access tokens are also bound to `/v1`.
MCP accepts OAuth access tokens bound to the public `/mcp` resource. Personal
API Keys remain an alternative REST credential for Direct API Clients and CLI
automation. `GET /v1/me` reports the normalized Principal identity for REST calls.

REST and MCP clients discover their protected resources at
`/.well-known/oauth-protected-resource/v1` and
`/.well-known/oauth-protected-resource/mcp`; their metadata points to Web's public
Better Auth issuer. Better Auth 1.6.26 cannot yet onboard MCP clients through Client ID
Metadata Documents, so Taskome temporarily exposes unauthenticated Dynamic Client
Registration as a compatibility fallback. It creates only public authorization-code
clients with the `taskome` scope. Login, explicit consent, exact redirect matching,
and PKCE S256 remain mandatory; client credentials are unavailable. Client ID
Metadata Documents remain the preferred mechanism once the pinned auth provider
supports them.

Upload callers declare `size_bytes` when requesting a URL and must send both the
matching `Content-Length` and `If-None-Match: *` with the PUT request. Both
headers are signed, so uploads are capped at 50 MiB and an Input File's object
cannot be overwritten after its first successful upload.

## Configuration

Application-local settings use `APP_ENVIRONMENT`, `LOG_LEVEL`, and `DOCS_ENABLED`.
`DATABASE_URL` is required and uses the explicit `postgresql+psycopg` dialect.
SeaweedFS uses `SEAWEEDFS_INTERNAL_ENDPOINT` for gateway calls,
`SEAWEEDFS_PUBLIC_ENDPOINT` for caller-facing presigned URLs, and
`SEAWEEDFS_TASK_ENDPOINT` for Task Server input downloads. The public and Task
Server endpoints default to the internal endpoint. See `.env.example` for the full
storage and authentication settings. Gateway derives the session issuer and OAuth issuer from
`BETTER_AUTH_URL`, its internal JWKS URL from `WEB_INTERNAL_URL`, and the REST and
MCP resources from `GATEWAY_PUBLIC_URL`.
Personal API Key verification calls Web on its internal origin for every request.
Web and Gateway authenticate that narrow endpoint with the same dedicated
`WEB_GATEWAY_HMAC_SECRET` (at least 32 characters), which must not be reused as
`BETTER_AUTH_SECRET`.
Gateway owns only the `gateway` schema; Web/Auth's Drizzle-managed tables remain in
`public`. `REDIS_URL` configures the Redis instance checked by readiness; the
client uses explicit two-second connect and I/O timeouts.

At the production edge, Caddy sends only `/v1`, `/mcp`, and
`/.well-known/oauth-protected-resource/{v1,mcp}` to Gateway. Development docs, health,
auth, and `/internal` operations remain reachable only inside the deployment;
Web and Gateway publish no host ports, so Caddy is their sole public entry point.
OpenTelemetry keeps its standard `OTEL_*` names; setting
`OTEL_EXPORTER_OTLP_ENDPOINT` enables OTLP/HTTP traces and logs. See
`.env.example` for the local template.

The interactive CLI discovers Web's OAuth authorization server from REST
protected-resource metadata, so `gateway_url` is its only endpoint setting.

## Development checks

```bash
mise run //apps/gateway:test
mise run //apps/gateway:check
```

Start the supporting PostgreSQL service with `mise run dev:up`, then apply checked-in
revisions with `mise run //apps/gateway:db:migrate`. After a model change, generate
one reviewed candidate with `mise run //apps/gateway:db:revision "describe change"`
then apply it with `mise run //apps/gateway:db:migrate` before running `mise run
//apps/gateway:db:check`. Alembic reads the Gateway `DATABASE_URL` from the local
`.env`; the `mise` tasks load that file before running native Alembic commands. See
the [full development, CI, and production
workflow](../../docs/engineering/local-development.md#gateway-migration-workflow).

The production Compose stack runs `alembic upgrade head` once before Gateway starts;
it is the only production database-changing command. Native development uses
`localhost` in the URL; containers use the `postgres` host. Liveness is process-only;
readiness checks Postgres and Redis concurrently and returns a separate `ok` or
`error` result for each. SeaweedFS and JWKS are intentionally excluded because a
transient downstream failure should fail only the affected request, not pull the
Gateway out of rotation.

The source tree separates transport (`api`), operational concerns (`core`),
contracts (`schemas`), persistence (`models` and `repositories`), and business
orchestration (`services`).
