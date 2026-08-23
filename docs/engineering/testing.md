# Testing

Tests should exercise an agreed public seam. If a test needs to patch private
state, mock an ORM query builder, or cast a fake past the type checker, first
look for a missing production seam.

## Server

`apps/server` has two Vitest projects.

The `unit` project includes colocated `src/**/*.test.ts` files. HTTP tests call
the Hono app returned by `createApp()` through `app.request()`. The app factory
accepts narrow dependencies for readiness, authentication, and session lookup,
so these tests remain fast without replacing Drizzle or Better Auth internals.

The `integration` project includes `test/integration/**/*.test.ts`. It starts a
disposable PostgreSQL container, applies committed Drizzle migrations, and
then exercises Better Auth and feature routes through the same HTTP seam. Use
this tier for persistence, migration, and authentication behavior; never use
`db:push`, schema shortcuts, or mocked Drizzle queries as substitutes.

Run the suites with:

```bash
mise run //apps/server:test
mise run //apps/server:test:watch
mise run //apps/server:test:coverage
mise run //apps/server:test:integration
```

V8 coverage reports include production server source except generated schemas,
test helpers, type-only modules, and the process entry point. There is no
coverage threshold yet.

## CLI

`apps/cli` uses ordinary Go tests at exported command behavior seams.

```bash
mise run //apps/cli:test
mise run //apps/cli:test:race
mise run //apps/cli:test:coverage
```

## Repository defaults

```bash
mise run test
mise run test:integration
```

The default test task runs the service-free CLI and server suites. Container-
backed server tests stay explicit so the fast path does not require Docker.
The console, docs, and web apps do not have test tasks configured yet; add a
public test seam and an owning task when they gain behavior that warrants one.
