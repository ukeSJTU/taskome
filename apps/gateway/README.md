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
mise run gateway:dev
```

The gateway listens on `http://127.0.0.1:8000`. In development, the Scalar API
reference is at `/scalar` and its OpenAPI schema is at `/openapi.json`; the MCP
Streamable HTTP transport is mounted at `/mcp`.

For a production-style process, use `mise run gateway:start`. Gunicorn
manages four Uvicorn workers by default, gives in-flight requests 30 seconds to
finish on shutdown, and recycles workers after a jittered request budget; all
four values are environment-overridable. Production mode emits JSON logs,
enables HSTS headers, and disables Scalar and OpenAPI unless `DOCS_ENABLED=true`
is set explicitly. TLS termination stays at Caddy. Swagger UI and ReDoc are
disabled in every environment.

The always-on `/internal/openapi.json` endpoint serves the cached Public OpenAPI
projection consumed by Web's authenticated API reference. It includes only the
Direct API Client operations beneath `/v1`, publishes the configured public `/v1`
server, and documents only `X-API-Key` authentication. The full `/openapi.json`
schema remains the development and Orval source when docs are enabled.

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

MCP clients discover the protected resource at
`/.well-known/oauth-protected-resource/mcp`; its metadata points to Web's public
Better Auth issuer. Better Auth 1.6.26 cannot yet onboard clients through Client ID
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
SeaweedFS uses `SEAWEEDFS_INTERNAL_ENDPOINT` for gateway calls and
`SEAWEEDFS_PUBLIC_ENDPOINT` for caller-facing presigned URLs; the public endpoint
defaults to the internal endpoint. See `.env.example` for the full storage and
authentication settings. Gateway derives the session issuer and OAuth issuer from
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
`/.well-known/oauth-protected-resource/mcp` to Gateway. Development docs, health,
auth, and `/internal` operations remain reachable only inside the deployment;
Web and Gateway publish no host ports, so Caddy is their sole public entry point.
OpenTelemetry keeps its standard `OTEL_*` names; setting
`OTEL_EXPORTER_OTLP_ENDPOINT` enables OTLP/HTTP traces and logs. See
`.env.example` for the local template.

## Development checks

```bash
mise run gateway:test
mise run gateway:check
```

Start the supporting PostgreSQL service with `mise run dev:up`, change a model, then
generate a reviewed revision with `mise run gateway:db:revision`; it uses a
disposable PostgreSQL 18 container and creates no revision when metadata matches the
existing head. Apply revisions with `mise run gateway:db:migrate` — this is
the only path that builds the schema, in development, tests, and production alike
(see `docs/engineering/testing.md` for why tests run this same path instead of `metadata.create_all`); the production Compose stack runs `db:migrate` once before Gateway
starts. Native development uses `localhost` in the URL; containers use the `postgres`
host. Liveness is process-only; readiness checks Postgres and Redis concurrently
and returns a separate `ok` or `error` result for each. SeaweedFS and JWKS are
intentionally excluded because a transient downstream failure should fail only
the affected request, not pull the Gateway out of rotation.

The source tree separates transport (`api`), operational concerns (`core`),
contracts (`schemas`), persistence (`models` and `repositories`), and business
orchestration (`services`).
