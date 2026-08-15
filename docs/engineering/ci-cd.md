# CI/CD

## What runs, and when

`.github/workflows/ci.yml` is the only event-triggered workflow. It runs on every pull request and on pushes to `main`, classifies the changed paths, and calls the relevant reusable workflows. A new push to the same PR or branch cancels the previous run in progress.

The repository ruleset uses one stable required status check: `CI required`. That final job runs even when upstream lanes fail or are skipped, and passes only when every selected core lane succeeds. Browser E2E remains visible but is not part of the required gate.

| Lane             | Reusable workflow     | Runs when                                                                 | Work                                                                                     |
| ---------------- | --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TypeScript       | `_ci-typescript.yml`  | Always for formatting; additional jobs for affected TypeScript consumers  | Repository format, TypeScript lint/types, Web tests, and affected Web or Docs builds     |
| CLI              | `_ci-cli.yml`         | `apps/cli/**` or global tooling                                           | Go checks, vulnerability scan, tests, race detector, and build                           |
| Python           | `_ci-python.yml`      | Gateway, task-kit, fpocket, or shared Python tooling                      | Per-project checks and tests; integration suites stay separate from unit suites          |
| OpenAPI contract | `_ci-contract.yml`    | Gateway, client generator, generated client, or relevant lockfile changes | Forced Gateway OpenAPI export, parallel TypeScript/Go regeneration, and clean-tree check |
| Browser E2E      | `_ci-browser-e2e.yml` | Web, Gateway, Web shared packages, or global tooling                      | Production-shaped Playwright suite and failure diagnostics                               |

Pure changes under `docs/**` run only the repository formatter and `CI required`. Unknown paths fail safe by selecting every lane, so adding a new top-level component cannot silently bypass CI. The routing rules live in `.github/scripts/classify-ci-changes.sh`.

Gateway changes always select the OpenAPI contract lane. `mise run openapi:verify` forces the complete generation graph:

```text
Gateway OpenAPI export
├── TypeScript client generation
└── Go client generation
```

The two client generators run in parallel after the shared export. CI then fails if the checked-in OpenAPI document or either generated client differs.

## Required check policy

The `Require CI` repository ruleset requires only `CI required`. Do not add path filters to independently triggered required workflows: GitHub leaves a required workflow pending when its trigger-level path filter skips the workflow. Selection happens inside the always-triggered coordinator instead.

Browser E2E is intentionally outside `CI required`. A failing selected Browser E2E lane is visible on the PR but does not block merging. Add it to the final gate only as a deliberate merge-policy change.

## Caches and artifacts

CI caches dependency downloads and framework compilation caches, never installed environments or generated deliverables:

- pnpm store, not `node_modules`;
- root and fpocket uv caches with separate lock-derived keys, not `.venv`;
- Go module and build caches resolved from the active mise toolchain, not `apps/cli/bin`;
- separate `apps/web/.next/cache` and `apps/docs/.next/cache` entries.

Only Browser E2E uploads artifacts. It retains `playwright-report` and `test-results` for 14 days and uploads them even when the test fails. Generated API clients and Playwright browser binaries are not cached.

## Security boundary

The coordinator uses only `pull_request` and trusted `push` triggers with `contents: read`. Reusable workflows have no independent triggers. Every action is pinned to a full commit SHA, checkout credentials are not persisted, and event values enter shell steps through environment variables rather than direct expression interpolation.

CI uses GitHub-hosted runners and does not receive deployment credentials or repository secrets. Placeholder Web build values are non-secret job-local environment variables.

## Deployment

There is currently no CI-driven deploy step. CI compiles affected applications but does not push images or trigger a deployment. The production-shaped stack (`compose.prod.yml` + Caddy) is started with `mise run prod:up`; see [`docs/engineering/local-development.md`](./local-development.md#production-shaped-stack) for the command and [`docs/architecture/deployment.md`](../architecture/deployment.md) for the topology it drives.

## Dependency updates

Dependabot runs separately on a weekly schedule (Mondays) across npm, uv, GitHub Actions, the Web Dockerfile, Docker Compose, and git submodules. Its pull requests enter the same path-classified CI workflow as any other pull request.

## Related docs

- [`docs/engineering/testing.md`](./testing.md) — Browser E2E details and per-area test commands.
- [`docs/engineering/local-development.md`](./local-development.md) — running the same checks locally before you push.
