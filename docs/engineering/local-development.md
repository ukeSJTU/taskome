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
mise run //apps/gateway:db:migrate
```

Gateway owns its schema through Alembic migrations — there's no `db:push`/`create_all` shortcut (see the ADR governing Gateway schema management once it's written).

### Gateway migration workflow

Alembic receives its connection URL from `DATABASE_URL`. Gateway's `mise` database
tasks load `apps/gateway/.env` and execute native Alembic commands; use `mise run
setup` before them so that local file exists.

**Development:** Apply shared revisions with `mise run //apps/gateway:db:migrate`.
Once a model change is ready to test and review, first ensure the local database is at
head, then generate a candidate migration:

```bash
mise run //apps/gateway:db:migrate
mise run //apps/gateway:db:revision "add job priority"
mise run //apps/gateway:db:migrate
mise run //apps/gateway:db:check
```

`db:revision` does not apply migrations itself, so `db:migrate` must run again before
`db:check`. Review generated operations and amend them for renames, data backfills,
non-null constraints, indexing, or destructive changes. A migration that only exists
on a feature branch can be rewritten; after rewriting it, rebuild the local `gateway`
schema and run `db:migrate` from empty to verify the complete history. A migration
merged into `main` is immutable.

**CI:** Integration tests create an isolated Postgres database, upgrade it through
the checked-in Alembic history, and run `alembic check`. A model change without a
matching migration therefore fails before merge.

**Production:** The one-shot `gateway-migrate` Compose service runs `alembic upgrade
head` after Postgres is healthy. Gateway waits for that service to complete
successfully. Production never runs `revision` or `check`; it consumes reviewed,
checked-in migrations only. For deployed data, make incompatible changes in expand →
compatible deploy → backfill → contract stages unless an explicit maintenance window
has been chosen.

## 4. Run the apps

```bash
mise run dev
```

Starts Web, Gateway, and Docs together, with prefixed output. To run one at a time, use the owning app's qualified task: `mise run //apps/web:dev`, `mise run //apps/gateway:dev`, or `mise run //apps/docs:dev`.

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

`mise run <task>` is the repository-wide command surface. Root tasks coordinate the repository; app and package tasks are addressed by qualified paths such as `//apps/gateway:test` and `//packages/db:migrate`. Their underlying `pnpm`, `uv`, and `go` commands are implementation details.

Run `mise tasks` to list the root workflows. Run `mise tasks --all` when you need the complete public app/package catalog; support tasks hidden from normal discovery remain available to the documented worktree and Browser E2E workflows.

### Setup and environment

| Task                     | What it does                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `mise run setup`         | Install dependencies, create local env files, install Git hooks                          |
| `mise run env:init`      | Create missing Web/Gateway env files without overwriting existing ones                   |
| `mise run deps:outdated` | Report available Node/Python/GitHub Action/mise tool updates, without changing lockfiles |

### Running apps

| Task                                                                       | What it does                             |
| -------------------------------------------------------------------------- | ---------------------------------------- |
| `mise run dev`                                                             | Start Web, Gateway, and Docs together    |
| `mise run //apps/web:dev` / `//apps/gateway:dev` / `//apps/docs:dev`       | Start one app                            |
| `mise run //apps/web:start` / `//apps/gateway:start` / `//apps/docs:start` | Start one production-mode app process    |
| `mise run //apps/cli:run -- <args>`                                        | Run the CLI from source                  |
| `mise run dev:up` / `dev:down` / `dev:logs`                                | Start / stop / tail dev-support services |
| `mise run build`                                                           | Build CLI, Web, and Docs                 |

### Quality

| Task              | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `mise run check`  | Read-only checks across Go, TypeScript, and Python                |
| `mise run lint`   | Lint TypeScript and Python, with safe autofixes                   |
| `mise run format` | Format Go, TypeScript, and Python                                 |
| `mise run test`   | Run every app/package's service-free test suite (not Browser E2E) |

See [`docs/engineering/testing.md`](./testing.md) for per-area test commands and Browser E2E.

### Database

| Task                                                           | What it does                                |
| -------------------------------------------------------------- | ------------------------------------------- |
| `mise run //packages/db:push \| generate \| migrate \| studio` | Operate on the Web-owned Drizzle schema     |
| `mise run //apps/gateway:db:migrate \| revision \| check`      | Operate on the Gateway-owned Alembic schema |

### API client

| Task                        | What it does                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `mise run openapi:generate` | Export Gateway OpenAPI once, then regenerate the TypeScript and Go clients in parallel                       |
| `mise run openapi:verify`   | Force regeneration and fail on staged, unstaged, or untracked changes beneath the checked-in generated paths |

### Production-shaped stack

| Task                                        | What it does                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `mise run prod:build \| up \| down \| logs` | Build / start / stop / tail the production-shaped Compose stack (Web, Docs, Gateway, Caddy) |

See [`docs/architecture/deployment.md`](../architecture/deployment.md) for the topology this drives.

## Related docs

- [`docs/engineering/testing.md`](./testing.md) — running and organizing tests.
- [`docs/engineering/observability.md`](./observability.md) — reading traces and logs locally.
- [`docs/engineering/ci-cd.md`](./ci-cd.md) — what CI runs on your PR.
