# Taskome server

`apps/server` is Taskome's Node.js control-plane API. It owns authentication,
authorization, the application REST surface, and Taskome domain records in
PostgreSQL. Scientific compute runs outside this process.

The current implementation provides Better Auth, health checks, the current-user
endpoint, OpenAPI generation, and the database foundation. The complete Tool,
Job, Attempt, file, MCP, and Agent Assistant APIs remain target behavior.

## Run the server locally

The repository setup task creates `apps/server/.env` from `.env.example`. Start
the local support services, apply committed migrations, and run the server:

```bash
mise run setup
mise run dev:up
mise run //apps/server:db:migrate
mise run //apps/server:dev
```

The API listens on [http://localhost:3000](http://localhost:3000) by default.
Use [`/healthz`](http://localhost:3000/healthz) for process liveness and
[`/readyz`](http://localhost:3000/readyz) to verify PostgreSQL connectivity.

## Use the HTTP surface

| Path            | Purpose                          |
| --------------- | -------------------------------- |
| `/healthz`      | Process liveness                 |
| `/readyz`       | PostgreSQL readiness             |
| `/api/auth/*`   | Better Auth endpoints            |
| `/api/v1/*`     | Versioned application API        |
| `/openapi.json` | OpenAPI 3.1 application contract |
| `/reference`    | Scalar API reference             |

Better Auth owns its response contract and is intentionally absent from the
application OpenAPI document. Application errors use
`application/problem+json`; Zod request failures return `422`, unknown routes
return `404`, and unhandled failures produce safe `500` responses.

Evlog is the application logger. Request events carry a request ID and, after
authentication, the user ID. The observability rules prohibit logging request
bodies, cookies, authorization headers, passwords, and tokens.

## Understand the source layout

```text
src/
├── app.ts                 # pure Hono composition and HTTP test seam
├── runtime.ts             # process resources and dependency wiring
├── index.ts               # listener, signals, and graceful shutdown
├── auth.ts                # Better Auth instance discovered by its CLI
├── db.ts                  # process-level PostgreSQL instance
├── auth/                  # session types and authorization middleware
├── db/                    # database factory and Drizzle schemas
├── http/                  # cross-cutting HTTP policy
└── features/<feature>/    # vertical business slices
```

A feature starts flat and exposes its public router from `index.ts`:

```text
features/widgets/
├── index.ts
├── widgets.routes.ts
├── widgets.handlers.ts
├── widgets.module.ts
├── widgets.repository.ts
└── widgets.schemas.ts
```

Dependencies point inward from route to handler to module to repository. Add a
repository only when a feature persists data. Shared authentication, database,
and HTTP policy remain in their owning top-level modules rather than becoming a
second application layer.

## Change the database

Edit `src/db/schema/`, then generate a named migration, review the SQL under
`drizzle/`, and apply the committed migration:

```bash
mise run //apps/server:db:generate -- add-widget
mise run //apps/server:db:migrate
```

When Better Auth configuration or plugins change, regenerate its schema before
generating the Drizzle migration:

```bash
mise run //apps/server:auth:generate
mise run //apps/server:db:generate -- update-auth
mise run //apps/server:db:migrate
```

Taskome deliberately has no `db:push` task. Shared, local, and test databases
are built from committed migrations.

## Verify a change

```bash
mise run //apps/server:check
mise run //apps/server:test
mise run //apps/server:test:integration
```

Unit and HTTP tests are colocated with source and call `createApp().request()`.
Integration tests live under `test/integration`, start disposable PostgreSQL
with Testcontainers, apply real migrations, and exercise Better Auth and Hono
through the public HTTP seam.

## Related documentation

- [`docs/architecture/containers.md`](../../docs/architecture/containers.md)
  defines the server's accepted target responsibility.
- [`docs/engineering/coding-standards.md`](../../docs/engineering/coding-standards.md)
  owns repository-wide API and module conventions.
- [`docs/engineering/observability.md`](../../docs/engineering/observability.md)
  owns logging and telemetry rules.
- [`docs/engineering/testing.md`](../../docs/engineering/testing.md) defines
  server test seams and suite placement.
- [`AGENTS.md`](AGENTS.md) contains server-specific instructions for AI agents.
