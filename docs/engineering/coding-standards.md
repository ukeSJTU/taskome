# Coding standards

This page covers conventions that tooling can't enforce. `mise run check` already runs the configured Go, TypeScript, and Python checks across the whole repo — if a rule can be automated, it belongs in tooling rather than a paragraph here. What's left is judgment: naming, where things depend on each other, and how APIs and schemas take shape.

## Naming

| What                                     | Convention                         | Example                                           |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| TypeScript files                         | kebab-case                         | `login-form.tsx`, `data-table.tsx`                |
| React components                         | PascalCase export, kebab-case file | `export function LoginForm()` in `login-form.tsx` |
| TS module exports (Drizzle tables, etc.) | camelCase                          | `export const oauthClient = pgTable(...)`         |
| Postgres tables and columns              | snake_case                         | `input_files`, `owner_user_id`, `created_at`      |
| Python classes                           | PascalCase                         | `class InputFile(Base)`                           |
| Python modules and functions             | snake_case                         | `input_files.py`, `get_owner_user_id()`           |
| OpenAPI `operationId`                    | camelCase, verb-first              | `getCurrentUser`, `createJob`                     |

Keep `operationId` stable: generated clients and API tooling use it as the
operation's programmatic name.

## Module and import boundaries

- A workspace package (`packages/*`) is imported by its package name (`@taskome/ui`, `@taskome/db`), never by a relative path that reaches across package boundaries (`../../../packages/ui/src/...`).
- Within an app, prefer path aliases over long relative chains once an import crosses more than one directory level.
- `apps/server` uses vertical feature slices under `src/features/<feature>/`.
  Follow its README's route → handler → module → repository dependency direction
  rather than growing a shared controller or generic repository layer.
- Taskome has two separate frontend apps — don't conflate them: `apps/web` is
  the public marketing site; `apps/console` is the signed-in product console,
  the `Web App` container [`architecture/containers.md`](../architecture/containers.md)
  describes. Neither has a documented internal routing or component
  convention yet; don't assume one from the other.

## API and schema design

- `apps/server`'s REST contract is declared with Zod and `createRoute`, then
  exposed at `/openapi.json`. Contract changes include an HTTP test through
  `app.request()`; do not maintain a second hand-written response schema.

The Tool/Job/Attempt REST and MCP API doesn't exist in `apps/server` yet — the
only feature slice implemented so far is `me`. Once that API exists, this
section should gain the conventions for it (curated parameter contracts,
Params/Result schema shape); until then, that's a target-architecture
question for [`architecture/components/tool-runtime.md`](../architecture/components/tool-runtime.md),
not a coding standard for code that doesn't exist.

## Not covered here

- **Error handling** — two different things, one implemented and one not:
  `apps/server`'s HTTP-level `application/problem+json` convention (RFC 9457)
  is documented in its own README; follow it, don't re-derive a competing
  convention. `packages/toolkit`'s Attempt `failure_kind` classification
  doesn't exist yet — see [`architecture/components/tool-runtime.md`](../architecture/components/tool-runtime.md)
  for its target design, and add a convention here once that package exists.
- **Comments** — root `CLAUDE.md` already states the rule (default to none; only when the WHY is non-obvious). This page doesn't repeat it.
- **Where a component file lives** — that's `apps/web/AGENTS.md` and `apps/docs/AGENTS.md`'s job (an app-specific Invariant), not a repo-wide coding standard. `apps/console` doesn't have one of these yet.
- **Development workflow** (branching, commits, PRs, worktrees) — see [`docs/engineering/local-development.md`](./local-development.md).

## Related docs

- [`docs/engineering/local-development.md`](./local-development.md) — day-to-day workflow.
- [`docs/engineering/testing.md`](./testing.md) — test seams and conventions.
- [`docs/engineering/observability.md`](./observability.md) — `evlog` as
  `apps/server`'s logger, and the correlation fields its request logging
  already carries.
- [`architecture/components/tool-runtime.md`](../architecture/components/tool-runtime.md) —
  the target Tool/Job API and schema design this page defers until it's implemented.
