# CI/CD

## What runs, and when

One workflow, `.github/workflows/ci.yml`, triggered on every pull request and on push to `main`. A new push to the same PR/branch cancels the previous run in progress rather than queuing behind it.

Five jobs run in parallel — none depends on another finishing first:

| Job                | What it does                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check`            | `mise run check`: read-only Go, TypeScript, and Python lint, format, module, and type checks across the whole repo.                                          |
| `test-unit`        | Unit tests for the Go CLI, TypeScript packages/apps, Gateway, and `packages/task-kit`.                                                                       |
| `test-integration` | Gateway and `packages/task-kit` integration tests. Python-only job — no pnpm install here.                                                                   |
| `browser-e2e`      | The production-shaped Playwright suite (`E2E_PRODUCTION=1`). See [`docs/engineering/testing.md`](./testing.md) for what it covers and how to run it locally. |
| `build`            | Compiles CLI, Web, and Docs with CI-only placeholder environment variables. Does not deploy or publish anything.                                             |

Every job shares the same setup: checkout, `mise` toolchain install, pnpm/uv cache restore, dependency install, then the job-specific step.

**Whether these are required status checks for merging** is a GitHub branch-protection setting, not something stored in the workflow file — this page can't state that as fact, so it doesn't.

## Artifacts

Only `browser-e2e` uploads artifacts: `playwright-report` and `test-results`, retained for **14 days**, uploaded even on failure. No other job retains anything.

## Deployment

There is currently **no CI-driven deploy step**. `build` compiles CLI, Web, and Docs; nothing pushes images or triggers a deploy anywhere. The production-shaped stack (`compose.prod.yml` + Caddy) is started with `mise run prod:up` — see [`docs/engineering/local-development.md`](./local-development.md#production-shaped-stack) for the command and [`docs/architecture/deployment.md`](../architecture/deployment.md) for the topology it drives — but running it today is a manual, operator-run step, not something CI triggers.

## Dependency updates

Dependabot runs separately from `ci.yml`, on a weekly schedule (Mondays), across five ecosystems (npm, uv, GitHub Actions, the Web Dockerfile, Docker Compose, and git submodules), grouped into one minor/patch PR per ecosystem. Its PRs go through the same `ci.yml` workflow as any other PR — there's no separate CI path for them.

## Related docs

- [`docs/engineering/testing.md`](./testing.md) — Browser E2E details and per-area test commands.
- [`docs/engineering/local-development.md`](./local-development.md) — running these same checks locally before you push.
