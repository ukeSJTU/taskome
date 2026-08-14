# Coding standards

This page covers conventions that tooling can't enforce. `mise run check` already runs `oxlint`, `oxfmt`, `ruff`, and `ty` across the whole repo (TypeScript and Python) — if a rule can be a lint rule, it's a lint rule, not a paragraph here. What's left is judgment: naming, where things depend on each other, and how APIs and schemas take shape.

## Naming

| What                                     | Convention                         | Example                                           |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| TypeScript files                         | kebab-case                         | `login-form.tsx`, `data-table.tsx`                |
| React components                         | PascalCase export, kebab-case file | `export function LoginForm()` in `login-form.tsx` |
| TS module exports (Drizzle tables, etc.) | camelCase                          | `export const oauthClient = pgTable(...)`         |
| Postgres tables and columns              | snake_case                         | `input_files`, `owner_user_id`, `created_at`      |
| Python classes                           | PascalCase                         | `class InputFile(Base)`                           |
| Python modules and functions             | snake_case                         | `input_files.py`, `get_owner_user_id()`           |
| FastAPI `operation_id`                   | camelCase, verb-first              | `getLiveness`, `getReadiness`                     |

The `operation_id` convention matters beyond style: `packages/api-client` generates its function names from it via orval, so a sloppy `operation_id` becomes a sloppy method name in every caller.

## Module and import boundaries

- A workspace package (`packages/*`) is imported by its package name (`@taskome/ui`, `@taskome/db`), never by a relative path that reaches across package boundaries (`../../../packages/ui/src/...`).
- Within an app, prefer path aliases over long relative chains once an import crosses more than one directory level.
- `apps/gateway`'s REST endpoints live one file per resource under `api/v1/endpoints/` (see `auth.py`, `input_files.py`) — follow that layout for new resources rather than growing one large router file.
- `apps/web`'s API routes follow Next.js's `app/api/<segment>/route.ts` convention; group related routes under a shared segment (`api/gateway/*`, `api/internal/*`) rather than flattening everything under `api/`.

## API and schema design

- A Task's REST/MCP parameters are a curated subset of the underlying tool's real configuration — see [`docs/product/vision.md`](../product/vision.md) for the policy this executes. Don't add a parameter just because the underlying tool exposes it; add it because it's worth exposing.
- Params and Result types are the schema contract at a Task's boundary (Pydantic on the Task Server side). Keep them flat where the underlying tool allows it — nested optional structures push complexity onto every caller (REST client, MCP agent, and the generated TS client alike).
- Changing a Gateway REST contract means regenerating `packages/api-client` (`mise run api-client:generate`) in the same change — a schema change without a regenerated client is an incomplete change, not two separate ones.

## Not covered here

- **Error handling** — `packages/task-kit`'s README documents the project's error taxonomy (RFC 9457/JSON-RPC mapping) in full. Follow it; don't re-derive a competing convention for a new Task Server.
- **Comments** — root `CLAUDE.md` already states the rule (default to none; only when the WHY is non-obvious). This page doesn't repeat it.
- **Where a component file lives** — that's `apps/web/AGENTS.md` and `apps/docs/AGENTS.md`'s job (an app-specific Invariant), not a repo-wide coding standard.
- **Development workflow** (branching, commits, PRs, worktrees) — see [`docs/engineering/local-development.md`](./local-development.md).

## Related docs

- [`docs/engineering/local-development.md`](./local-development.md) — day-to-day workflow.
- [`docs/engineering/testing.md`](./testing.md) — test seams and conventions.
