# Taskome server

`apps/server` is Taskome's Node.js control-plane API. It owns authentication,
authorization, the application REST surface, and Taskome domain records in
PostgreSQL. Scientific compute runs outside this process.

The current implementation provides browser sessions, scoped API keys, the
OAuth and MCP authorization foundation, health and readiness checks, the
current-user endpoint, OpenAPI generation, and PostgreSQL persistence. The
product domain and compute-coordination APIs described by the target
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

Better Auth and its API-key, CIMD, MCP, and OAuth Provider packages stay on
the pinned 1.7 integration line. The MCP endpoint uses version 2 of the
official TypeScript SDK.

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

## Use programmatic access in development

Taskome derives both protected resources from `BETTER_AUTH_URL`:

- the REST resource is `<origin>/api/v1`;
- the MCP resource and endpoint are `<origin>/mcp`.

The development scope registry contains `taskome:access`. API keys use the
`sk-` prefix and the standard bearer header:

```http
Authorization: Bearer sk-<secret>
```

API-key management is available only through Taskome's `/api/v1/api-keys`
operations with a verified user and a browser session created within the last
15 minutes. Creation returns the secret once. List, inspect, update, and revoke
responses contain metadata only. The default lifetime is 90 days, and the
maximum is 365 days.

OAuth discovery, authorization, token, JWKS, CIMD, and specific-token
revocation stay under Better Auth's protocol routes. Dynamic Client
Registration is disabled. The canonical `/mcp` route accepts ordinary Bearer
tokens, rejects the legacy session-oriented MCP protocol, and checks the
Taskome OAuth Grant in PostgreSQL after JWT verification.

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

The auth generator uses `src/auth.generate.ts`, which omits runtime schema
validation while producing the new schema. Production uses `src/auth.ts` and
validates the complete generated schema. Tests use the separate
`src/auth.test-instance.ts`; only that instance includes Better Auth's
privileged `testUtils()` context.

After authentication, authorization, or persistence changes, run both suites:

```bash
mise run //apps/server:test
mise run //apps/server:test:integration
```
