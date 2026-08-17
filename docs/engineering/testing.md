# Testing

This page covers both how this repo's test suites are organized and how to run them. It replaces `docs/browser-e2e.md` and `docs/agents/testing.md` — there's one testing doc now, not a human-facing and an AI-facing copy of the same material.

If you're using the `tdd` skill, read this page alongside it: this page is the project-specific answer to "where do seams live and how is the infrastructure wired," not a replacement for the skill's guidance on seams, anti-patterns, and the red-green loop.

## Governing principle

A hard-to-test seam is a design smell, not a testing problem. If writing a test requires heavy infrastructure — spinning up two containers to test orchestration logic, monkeypatching a shared class attribute to fake a dependency, casting a fake past the type checker — stop and ask whether the production code is missing a seam (a `Protocol`/port, a constructor-injected dependency) before reaching for more test scaffolding.

## How each area organizes its tests

### `apps/gateway` (pytest)

Seam layering maps to the existing `api/v1` → `services` → `repositories` module split:

| Layer          | Seam         | Tier                | Why                                                                                     |
| -------------- | ------------ | ------------------- | --------------------------------------------------------------------------------------- |
| `repositories` | direct calls | integration only    | the layer's only job is SQL/ORM correctness — faking it tests nothing                   |
| `services`     | direct calls | unit                | fake repository + fake storage, both typed against a `Protocol`, not the concrete class |
| `api/v1`       | `TestClient` | unit or integration | determined by what's behind it in a given test, not by the layer itself                 |

Directory structure is a physical `unit`/`integration` split (different `conftest.py` per subtree wires different infrastructure), mirrored by module underneath for navigation only:

```text
apps/gateway/tests/
├── conftest.py              # repo-wide shared fixtures
├── unit/
│   ├── conftest.py           # fake repository/storage
│   └── services/test_input_files.py
└── integration/
    ├── conftest.py           # session-scoped Postgres testcontainer + alembic upgrade head
    ├── repositories/test_input_files.py
    └── api/test_input_file_api.py
```

No `@pytest.mark.unit`/`integration` markers — the directory split already does the selection. The database fixture is a session-scoped Postgres testcontainer with the schema built by Alembic's real `command.upgrade(..., "head")` path (not `metadata.create_all`); test isolation is transaction rollback, not truncate or per-test containers. Running the real migration is slower than building the schema directly from models, but `create_all` can't catch a broken or missing migration — the trade-off is deliberate: these tests are also the thing that would notice a migration bug before production does.

### `packages/task-kit` and `apps/task-*` (pytest)

Tests use exactly three public seams:

| Owner                         | Seam                                                                         | Tier                     | What it proves                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| each Task Server              | direct `ComputeAdapter.run(params, ctx)`                                     | unit or tool integration | curated translation to the real compute tool, error classification, Result and Produced Files   |
| task-kit and each Task Server | the app returned by `build_task_server`, over REST and a real FastMCP client | unit/contract            | strict flat Params, REST/MCP parity, errors, manifest, lifecycle, workdir behavior              |
| task-kit only                 | production verifier/resolver/publisher, through external HTTP and SeaweedFS  | integration              | HMAC, streaming and exact sizes, conditional object writes, metadata, rollback, client lifespan |

`task_kit.testing` provides supported builders for a `ComputeContext` and a fake `TaskServerRuntime`. Task Server tests use those helpers rather than constructing private DTOs, monkeypatching task-kit modules, or recreating HMAC/storage implementations. A test must not inspect task-kit's private registry, execution outcome, workdir manager, or transport objects.

Each `apps/task-*` keeps its own lockfile and test configuration. Its unit suite covers adapter semantics and one REST/MCP parity example — it does not repeat task-kit's exhaustive HMAC, path traversal, rollback, or FastMCP compatibility matrix.

### `apps/web` (Vitest)

Seam scope: Next.js route handlers, `lib` functions with real logic (for example `request-context.ts`'s `AsyncLocalStorage` propagation), and components with non-trivial state/validation logic or that are shared across pages. Out of scope: `packages/ui`'s vendored shadcn primitives, and purely presentational components with no branching logic.

There's no physical unit/integration split here — nothing in web touches Docker or needs isolation from "fast" tests, even the better-auth instance used in tests is in-memory. "Integration-style" just means exercising a real downstream implementation (a fresh `createTestAuth()`, a full route handler) instead of stubbing everything; it still runs in the same fast job.

Tests stay colocated (`*.test.ts(x)` next to source). `Vitest` config uses `test.projects` to split by path (`node` project for route handlers/`lib`, `jsdom` project for components) instead of per-file environment comments. Shared test infrastructure lives in `apps/web/src/test/` (MSW server setup, a `useTestAuth()` helper wired to `packages/auth`'s `createTestAuth()`, a custom `render()` wrapping `ThemeProvider`).

Network mocking uses both `vi.mock("@taskome/api-client")` and MSW, situationally: module mock for "did this call the right method," MSW for real network/error-handling semantics.

**Known production gap found via testing:** `LoginForm`/`SignupForm` block submission on invalid input, but per-field error messages never render (`field.state.meta.errors` doesn't populate) — invalid submissions currently fail silently from the user's perspective. Tests assert the part that does work and note the gap inline; fixing it is separate, application-level work.

### Browser E2E (Playwright)

Owned by `apps/web/e2e/`. Its seam begins at a real Chromium page and observes user-visible navigation and content — it never mocks Web-to-BFF or BFF-to-Gateway traffic, queries a database as an assertion side channel, or reaches into component state.

The suite covers only high-value deployed boundaries: access control, sign-up, sign-in, live REST API docs through the Web BFF, and MCP OAuth onboarding (dynamic registration, PKCE, consent, token exchange, a real `list_tools` call). Existing Vitest and pytest tests retain focused UI, BFF, and OAuth negative-path behavior — Browser E2E doesn't repeat them. It's deliberately separate from `mise run test`, which stays service-free and fast.

## Running tests

Whole-repo:

```bash
mise run test
```

Runs every app/package's service-free test suite (Go, TypeScript, and Python) in parallel. This does not include Browser E2E — see below.

Per-area:

```bash
mise run //apps/gateway:test          # all gateway tests
mise run //apps/gateway:test:unit
mise run //apps/gateway:test:integration
mise run //apps/web:test              # web (Vitest)
mise run //apps/web:test:watch
mise run //apps/web:test:coverage
mise run //apps/cli:test              # CLI (Go)
mise run //apps/cli:test:race
```

`packages/task-kit` and each `apps/task-*` run their own `unit`/`integration` split the same way, scoped with `mise run //packages/task-kit:test:unit` (and similarly for `apps/task-fpocket`).

### Browser E2E

```bash
mise run test:browser-e2e         # headless
mise run test:browser-e2e:ui      # interactive Playwright UI
mise run test:browser-e2e:debug   # headed, with the Inspector
```

Each run starts a uniquely named, disposable Docker Compose project with Postgres and Redis on unique ports, migrates both application schemas, then starts native Web and Gateway processes against it. The runner tears everything down on success, failure, or interruption, and writes service logs next to the Playwright results when a run fails.

SeaweedFS is available through the Compose `storage` profile for browser scenarios that exercise object storage:

```bash
COMPOSE_PROFILES=storage mise run test:browser-e2e
```

The current Browser E2E scenarios do not upload or download objects, so the default run leaves this profile disabled. Gateway integration tests retain the real SeaweedFS storage boundary coverage.

## What CI runs

CI classifies changed paths and calls language- or contract-specific reusable workflows. Within the selected Python lane, unit and integration jobs remain separate so fast failures report without waiting on testcontainers. CLI tests and the race detector run together in their own job; Web tests run in the TypeScript lane.

Browser E2E runs only for affected Web, Gateway, shared Web-package, or global-tooling changes. It uses the production-shaped variant (`E2E_PRODUCTION=1`) and uploads `playwright-report`/`test-results` with **14-day retention**. Browser E2E is visible but is not part of the `CI required` merge gate. See [`docs/engineering/ci-cd.md`](./ci-cd.md) for routing, required-check policy, and the complete lane list.

## Related docs

- [`docs/engineering/ci-cd.md`](./ci-cd.md) — the full CI job list.
- [`docs/engineering/coding-standards.md`](./coding-standards.md) — code-level conventions this page doesn't cover.
