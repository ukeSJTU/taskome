# Local development

## Goal

Get every native app (Web, Gateway, Docs) running locally against the dev-support services, and know where to find every other `mise` task once you're set up.

## Before you begin

You need `mise` itself installed. `mise` then pins and installs everything else this repo needs (Node 24, Python 3.14, pnpm 11, uv, lefthook) from `mise.toml` — you don't install those separately.

## 1. Install dependencies and local config

```bash
mise run setup
```

This installs locked dependencies (`pnpm install --frozen-lockfile`, `uv sync --locked`), creates missing `apps/web/.env` and `apps/gateway/.env` with generated local secrets (without printing or overwriting existing ones), and installs Git hooks (`lefthook install`). If both env files already exist, their `WEB_GATEWAY_HMAC_SECRET` values must be non-placeholder and identical — review either file before continuing.

## 2. Start dev-support services

```bash
mise run dev:up
```

Starts PostgreSQL, Redis, SeaweedFS, and a local `otel-gui` trace/log viewer via Docker Compose, and waits for them to be healthy. See [`docs/engineering/observability.md`](./observability.md) for using `otel-gui`.

## 3. Apply the Gateway schema

```bash
mise run gateway:db:migrate
```

Gateway owns its schema through Alembic migrations — there's no `db:push`/`create_all` shortcut (see the ADR governing Gateway schema management once it's written).

## 4. Run the apps

```bash
mise run dev
```

Starts Web, Gateway, and Docs together, with prefixed output. To run one at a time: `mise run web:dev`, `mise run gateway:dev`, `mise run docs:dev`.

## Verify the result

- Web: [localhost:3000](http://localhost:3000)
- Gateway: [localhost:8000](http://localhost:8000)
- Docs: [localhost:3001](http://localhost:3001)

If any of these don't come up, check `mise run dev:logs` for the dev-support services first — most local failures trace back to Postgres or SeaweedFS not being healthy yet.

## Day-to-day workflow

- **Branching and commits**: this repo enforces [Conventional Commits](https://www.conventionalcommits.org/) via a `commit-msg` hook (commitlint) — see root `AGENTS.md` for the exact convention. The hook is installed by `mise run setup`.
- **Worktrees**: before changing repository files, use the `using-git-worktrees` skill to choose between editing directly or working in an isolated worktree. `mise run worktree:create <type> <slug>` / `mise run worktree:remove <type> <slug>` back that skill.
- **Before opening a PR**: run `mise run check` (lint + format + typecheck, read-only) and `mise run test` (everything except Browser E2E — see [`docs/engineering/testing.md`](./testing.md)) locally. CI runs the same checks; catching failures locally is faster than waiting on CI.
- **Review**: use the `code-review` skill against the diff before opening a feature PR — see root `AGENTS.md`.

## Command reference

`mise run <task>` is the repository's primary command surface. Application and package `pnpm`/`uv` scripts are implementation details this table doesn't need to expose — `mise run` is what you type.

### Setup and environment

| Task                     | What it does                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `mise run setup`         | Install dependencies, create local env files, install Git hooks                          |
| `mise run env:init`      | Create missing Web/Gateway env files without overwriting existing ones                   |
| `mise run deps:outdated` | Report available Node/Python/GitHub Action/mise tool updates, without changing lockfiles |

### Running apps

| Task                                            | What it does                             |
| ----------------------------------------------- | ---------------------------------------- |
| `mise run dev`                                  | Start Web, Gateway, and Docs together    |
| `mise run web:dev` / `gateway:dev` / `docs:dev` | Start one app                            |
| `mise run dev:up` / `dev:down` / `dev:logs`     | Start / stop / tail dev-support services |
| `mise run build`                                | Build Web and Docs                       |

### Quality

| Task              | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `mise run check`  | Read-only: lint + format check + typecheck, whole repo (TS + Python) |
| `mise run lint`   | Lint whole repo, with safe autofixes                                 |
| `mise run format` | Format whole repo                                                    |
| `mise run test`   | Run every app/package's test suite (not Browser E2E)                 |

See [`docs/engineering/testing.md`](./testing.md) for per-area test commands and Browser E2E.

### Database

| Task                                                    | What it does                                |
| ------------------------------------------------------- | ------------------------------------------- |
| `mise run web:db:push \| generate \| migrate \| studio` | Operate on the Web-owned Drizzle schema     |
| `mise run gateway:db:migrate \| revision`               | Operate on the Gateway-owned Alembic schema |

### API client

| Task                           | What it does                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `mise run api-client:generate` | Regenerate `packages/api-client` from Gateway's OpenAPI spec                                   |
| `mise run api-client:verify`   | Regenerate and fail if that produces uncommitted changes (what CI-equivalent checks would run) |

### Production-shaped stack

| Task                                        | What it does                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `mise run prod:build \| up \| down \| logs` | Build / start / stop / tail the production-shaped Compose stack (Web, Docs, Gateway, Caddy) |

See [`docs/architecture/deployment.md`](../architecture/deployment.md) for the topology this drives.

## Related docs

- [`docs/engineering/testing.md`](./testing.md) — running and organizing tests.
- [`docs/engineering/observability.md`](./observability.md) — reading traces and logs locally.
- [`docs/engineering/ci-cd.md`](./ci-cd.md) — what CI runs on your PR.
