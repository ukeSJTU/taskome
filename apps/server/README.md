# Taskome server

`apps/server` is Taskome's Node.js control-plane API. It owns authentication and
application data in PostgreSQL; compute workloads remain outside this process.

## Run locally

```bash
cp apps/server/.env.example apps/server/.env
mise run dev:up
mise run //apps/server:db:migrate
mise run //apps/server:dev
```

The API listens on `http://localhost:3000` by default.

| Path            | Purpose                          |
| --------------- | -------------------------------- |
| `/healthz`      | Process liveness                 |
| `/readyz`       | PostgreSQL readiness             |
| `/api/auth/*`   | Better Auth endpoints            |
| `/api/v1/*`     | Versioned application API        |
| `/openapi.json` | OpenAPI 3.1 application contract |
| `/reference`    | Scalar API reference             |

Better Auth owns its response contract and is intentionally not copied into the
application OpenAPI document.

## Structure

```text
src/
├── app.ts                 # pure Hono composition; the HTTP test seam
├── runtime.ts             # process resources and dependency wiring
├── index.ts               # listen, signals, and graceful shutdown only
├── auth.ts                # Better Auth instance; discovered by its CLI
├── db.ts                  # process-level PostgreSQL instance
├── auth/                  # session types and authorization middleware
├── db/                    # database factory and Drizzle schemas
├── http/                  # cross-cutting HTTP policy
└── features/<feature>/    # one vertical business slice
```

A feature starts flat and uses suffixes to make responsibilities visible:

```text
features/widgets/
├── index.ts               # public router and middleware composition
├── widgets.routes.ts      # Zod/OpenAPI request-response contract
├── widgets.handlers.ts    # HTTP translation only
├── widgets.module.ts      # business use cases
├── widgets.repository.ts  # Drizzle queries, when persistence is needed
└── widgets.schemas.ts     # feature schemas
```

Dependencies point inward: route → handler → module → repository. Features do
not import another feature's private files; expose an intentional API from its
`index.ts` or move genuinely shared policy under `http/`, `auth/`, or `db/`.
Do not add generic repositories, a global service container, or a new layer
until a real feature needs it.

Use `./` imports inside one cohesive module or feature. Use the `@/` alias when
an import crosses a top-level module boundary or would otherwise climb through
`../`; use workspace package names for imports outside this app.

Application errors use `application/problem+json`. Zod request failures are
`422`; unknown routes are `404`; unhandled failures are safe `500` responses.
Stoker is limited to small OpenAPI/status helpers—do not use its deprecated
`oneOf` helpers.

Evlog is the only application logger. Request events carry the request ID and,
after authentication, the user ID. Do not log request bodies, cookies,
authorization headers, passwords, or tokens.

## Database changes

Edit `src/db/schema/`, then generate and review a committed migration:

```bash
mise run //apps/server:db:generate
mise run //apps/server:db:migrate
```

When Better Auth configuration changes, run its schema generator before
generating the Drizzle migration:

```bash
pnpm --dir apps/server auth:generate
mise run //apps/server:db:generate
```

There is deliberately no `db:push` command. Shared and test databases must be
built from committed migrations.

## Tests

```bash
mise run //apps/server:test
mise run //apps/server:test:coverage
mise run //apps/server:test:integration
```

Unit and HTTP tests are colocated with source and call `createApp().request()`.
Integration tests live in `test/integration/`, start disposable PostgreSQL with
Testcontainers, apply real migrations, and exercise Better Auth plus Hono over
the public HTTP seam. Coverage is reported with V8 and has no threshold yet.
