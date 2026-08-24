# Taskome server

`apps/server` is Taskome's Node.js control-plane API. It owns authentication,
authorization, the application REST surface, and Taskome domain records in
PostgreSQL. Scientific compute runs outside this process.

The current implementation provides Better Auth, health and readiness checks,
Project lifecycle APIs, OpenAPI generation, and the database foundation. The
remaining product domain and compute-coordination APIs described by the target
architecture are not implemented yet.

## Tech stack

| Technology                  | Role in the server                                          |
| --------------------------- | ----------------------------------------------------------- |
| Node.js and TypeScript      | Server runtime and type-safe application code               |
| Hono                        | HTTP routing, middleware, and application composition       |
| Zod and `@hono/zod-openapi` | Request and response validation and the OpenAPI contract    |
| Better Auth                 | Authentication, sessions, and auth database schema          |
| PostgreSQL and Drizzle ORM  | Application persistence, schema definitions, and migrations |
| Scalar                      | Interactive rendering of the generated API reference        |
| Evlog                       | Structured application and request logging                  |
| Vitest and Testcontainers   | HTTP tests and disposable PostgreSQL integration tests      |

## Run the server locally

Complete the repository setup in [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
first. The setup task creates `apps/server/.env` from
[`apps/server/.env.example`](.env.example).

From the repository root, start the local support services, apply committed
migrations, and run the server:

```bash
mise run dev:up
mise run //apps/server:db:migrate
mise run //apps/server:dev
```

The API listens on [http://localhost:3000](http://localhost:3000) by default.
Use [`/healthz`](http://localhost:3000/healthz) for process liveness and
[`/readyz`](http://localhost:3000/readyz) to verify PostgreSQL connectivity.

## Inspect the API

The server uses Scalar to render its current API reference at
[http://localhost:3000/reference](http://localhost:3000/reference).

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

Each feature is a vertical slice under `features/`. Dependencies point from
route to handler to module to repository, while shared authentication,
database, and HTTP policy remain in their owning top-level modules.

## Change the API contract

Declare application routes with Zod and `createRoute`. Application errors use
`application/problem+json`. Better Auth owns `/api/auth/*` and is not copied
into the application OpenAPI document.

After changing the contract, export the OpenAPI document and regenerate the
TypeScript and Go clients:

```bash
mise run //:api:generate
```

Review and commit the generated contract and clients with the source change.

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
