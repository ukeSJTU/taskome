# Testing conventions: `apps/web` and `apps/gateway`

How this repo's two apps organize tests. Read this alongside the `tdd` skill (seams, anti-patterns, the red-green loop) — this file is the project-specific answer to "where do seams live and how is the infrastructure wired," not a replacement for that skill.

`packages/*` is out of scope for these conventions — those packages are consumed as-is (e.g. `packages/auth`'s `createTestAuth()`), not rebuilt here.

## Governing principle: a hard-to-test seam is a design smell, not a testing problem

If writing a test requires heavy infrastructure (spinning up two containers to test orchestration logic, monkeypatching a shared class attribute to fake a dependency, `cast()`-ing a fake past the type checker) — stop and ask whether the production code is missing a seam (a `Protocol`/port, a constructor-injected dependency) before reaching for more test scaffolding. See ADR-0017 for the pattern this repo already uses for exactly this problem (`ComputeAdapter`).

## `apps/gateway` (pytest)

**Seam layering** maps to the existing `api/v1` → `services` → `repositories` module split:

| Layer          | Seam         | Tier                | Why                                                                                                                                                                        |
| -------------- | ------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repositories` | direct calls | integration only    | the layer's only job is SQL/ORM correctness — faking it tests nothing                                                                                                      |
| `services`     | direct calls | unit                | fake repository + fake storage (both typed against a `Protocol`, not the concrete class)                                                                                   |
| `api/v1`       | `TestClient` | unit or integration | determined by what's behind it in a given test, not by the layer itself — the same endpoint can have a unit test (service faked) and an integration test (full real stack) |

**Directory structure** — physical split for `unit`/`integration` (different `conftest.py` per subtree wires different infrastructure), mirrored by module underneath for navigation only (no marker needed there):

```
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

No `@pytest.mark.unit`/`integration` markers — the directory split already does the selection (`pytest tests/unit`), a marker would be a second mechanism doing the same job.

**Database fixture**: session-scoped Postgres testcontainer, schema built by running real `alembic upgrade head` (not `metadata.create_all`) — see ADR-0024. Isolation between tests is transaction rollback (`BEGIN` per test, `ROLLBACK` after), not truncate or per-test containers.

**Dependencies**: `pytest-asyncio` (`asyncio_mode = "auto"`, required — service/repository methods are `async def`), `pytest-mock` (the `mocker` fixture, replacing ad hoc `monkeypatch`/`unittest.mock.patch`), `polyfactory` (test data for Pydantic/SQLAlchemy models), `time-machine` (freezing time for `storage.py`'s presigned-URL expiry math). Not yet — `pytest-xdist` (suite is too small to need parallelism), `respx`/`pytest-httpx` (gateway makes no outbound `httpx` calls yet; add when a Task Server/compute-adapter integration does).

**CI**: `mise.toml`'s `test` task splits into `test:unit` and `test:integration`; CI runs them as separate parallel jobs (`test-unit`, `test-integration`) so unit failures report back fast without waiting on container startup.

## `apps/web` (Vitest)

**Seam scope**: Next.js route handlers, `lib` functions with real logic (e.g. `request-context.ts`'s `AsyncLocalStorage` propagation), and components with non-trivial state/validation logic or that are shared across pages (`login-form`, `signup-form`, `data-table`, `app-sidebar`). Not in scope: `packages/ui`'s vendored shadcn primitives, or purely presentational components with no branching logic.

**No unit/integration physical split.** Unlike gateway, nothing in web touches Docker or otherwise needs isolation from "fast" tests — even the better-auth instance used in tests is in-memory. "Integration-style" here just means exercising a real downstream implementation (a fresh `createTestAuth()`, a full route handler) instead of stubbing everything; it still runs in the same fast, single CI job.

**Vitest config** uses `test.projects` to split by path instead of per-file `// @vitest-environment` comments. Each project repeats `resolve.alias` explicitly (inheriting only from root proved unreliable — an alias would resolve on some runs and not others — so `vitest.config.ts` defines one `sharedAlias` object and spreads it into every project):

```ts
test: {
  clearMocks: true,
  unstubGlobals: true,
  coverage: { include: ["src/**/*.{ts,tsx}"] }, // otherwise untested files just vanish from the report instead of showing 0%
  projects: [
    { resolve: { alias: { ...sharedAlias, "next/headers": ... } },
      test: { name: "node", include: ["src/app/**/*.test.ts", "src/lib/**/*.test.ts"], environment: "node", setupFiles: ["./src/test/setup.ts"] } },
    { resolve: { alias: sharedAlias },
      test: { name: "jsdom", include: ["src/components/**/*.test.tsx", "src/app/**/_components/**/*.test.tsx"], environment: "jsdom", environmentOptions: { jsdom: { url: "http://localhost:3000" } }, setupFiles: ["./src/test/setup.jsdom.ts"] } },
  ],
}
```

**Directory**: tests stay colocated (`*.test.ts(x)` next to source) — the `test.projects` globs already key off that layout, no reason to centralize. Shared test infrastructure lives in `apps/web/src/test/`:

```
apps/web/src/test/
├── next-headers.ts   # next/headers mock (node project)
├── auth.ts           # useTestAuth() — fresh createTestAuth() instance wired into MSW per test
├── render.tsx         # custom render wrapping ThemeProvider (jsdom project)
├── setup.ts           # shared: mounts the MSW server (both projects)
├── setup.jsdom.ts      # jsdom-only: jest-dom matchers, matchMedia polyfill, RTL cleanup, imports setup.ts
└── msw/
    ├── handlers.ts    # empty for now — nothing client-side calls @taskome/api-client yet
    └── server.ts
```

`globals: false` means Testing Library's automatic `afterEach(cleanup)` never registers itself (it relies on an implicit global) — `setup.jsdom.ts` calls `afterEach(cleanup)` explicitly. Forgetting this shows up as "multiple elements found" errors from a previous test's DOM still being mounted.

**Network mocking**: `vi.mock("@taskome/api-client")` and MSW both stay, used situationally — module mock for "did this call the right method," MSW for real network/error-handling semantics (BFF route handlers reacting to gateway 4xx/5xx, or auth flows where hand-mocking every state transition would be brittle).

**better-auth `testUtils`**: `packages/auth/src/test.ts`'s `createTestAuth()` registers the `testUtils({ captureOTP: true })` plugin, exposing `ctx.test` helpers (`createUser`, `saveUser`, `login`, `getAuthHeaders`, `getOTP`). `test/auth.ts`'s `useTestAuth()` mounts a fresh instance's `.handler` behind MSW, so browser-client flows can exercise real validation and state transitions. `test/setup.ts` starts MSW during setup-file evaluation rather than in `beforeAll`: better-auth captures the current `fetch` when the module-level `authClient` is created during test collection, so interception must already be installed. `signup-form.integration.test.tsx` locks down the full UI → `authClient` → MSW → in-memory auth path. Module mocks remain appropriate when a component test only needs to assert the call contract or force a specific callback.

**Known production gap found via testing**: `LoginForm`/`SignupForm` use a single form-level `z.object(...)` validator (`validators: { onSubmit: schema }`). It correctly blocks submission on invalid input, but `field.state.meta.errors` never populates per field, so `FieldError` never renders a message — invalid submissions fail silently from the user's perspective. Not fixed here (out of scope for a test-infrastructure refactor); tests assert the part that does work (submission is blocked) and note the gap inline.

## Browser E2E (Playwright)

Browser E2E is owned by `apps/web/e2e/`. Its seam begins at a real Chromium page and observes user-visible navigation and content; it may use public HTTP endpoints for setup and public MCP endpoints for protocol outcomes. It never mocks Web-to-BFF or BFF-to-Gateway traffic, queries a database as an assertion side channel, or reaches into component state.

Run `mise run test:browser-e2e` for headless local verification, `mise run test:browser-e2e:ui` to inspect journeys interactively, or `mise run test:browser-e2e:debug` for headed Inspector debugging. Each run starts a uniquely named Docker Compose project with disposable Postgres, Redis, and SeaweedFS volumes, migrates both application schemas, then starts native Web and Gateway processes on unique ports. The runner tears everything down on success, failure, or interruption and writes service logs next to Playwright results when a run fails.

The suite covers only high-value deployed boundaries: access control, sign-up, sign-in, live REST API Docs through the Web BFF, and MCP OAuth onboarding through dynamic registration, PKCE, consent, token exchange, and a real `list_tools` operation. Existing Vitest and pytest tests retain focused UI, BFF, and OAuth negative behavior. Browser E2E is deliberately separate from `mise run test`, which remains service-free and fast.
