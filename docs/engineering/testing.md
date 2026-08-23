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

## Tool Runtimes

Each project under `runtimes/<upstream>` tests two public seams. Tests do not
reach into helper functions or import modules from the Pixi compute prefix.

The fast Runtime seam lives under `tests/runtime`. It invokes the Runtime's
Python interface with a fake Upstream Software subprocess and verifies curated
input translation, generated arguments or configuration, failure
classification, output validation, and manifest construction. These tests run
from the root uv workspace and never require Docker, a GPU, or scientific
compute dependencies. Root Ruff, ty, and pytest configuration covers Runtime
adapter code and these tests; it excludes the upstream compute environment.
Type checking runs per workspace package so Runtime packages remain
independently actionable.

The image seam lives under `tests/image`. It runs the final OCI entrypoint and
verifies that the uv adapter environment and Pixi compute prefix cooperate. It
also checks the non-root user, fixed filesystem contract, immutable Runtime
paths, required executables and dynamic libraries, mock behavior, and output
contract.

Runtime CI uses three levels:

1. Every pull request runs Ruff, ty, and the fast Runtime tests.
2. A change under one Runtime validates its committed locks, builds the final
   image, and runs the image tests in mock mode. A small CPU Runtime may add a
   real smoke fixture here.
3. Release or explicit qualification jobs run real scientific compute on the
   required CPU or GPU runner and verify output invariants, resource behavior,
   and the absence of undeclared compute-time downloads.

Host development does not provide a second supported real-compute path.
Developers run fast tests through uv and run real Upstream Software through the
same Runtime image used outside development. The target command surface is:

```bash
mise run runtime:test -- fpocket
mise run runtime:test:image -- fpocket
mise run runtime:qualify -- fpocket
```

These commands are target architecture until the first Runtime and the shared
`scripts/runtime/` build tooling exist. See
[`Tool Runtime packaging and runtime_toolkit`](../architecture/components/tool-runtime.md)
for the owning repository and image design.

## Repository defaults

```bash
mise run test
mise run test:integration
```

The default test task runs the service-free CLI and server suites. Container-
backed server tests stay explicit so the fast path does not require Docker.
The console, docs, and web apps do not have test tasks configured yet; add a
public test seam and an owning task when they gain behavior that warrants one.
