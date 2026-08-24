# Coding standards

This page covers conventions that tooling cannot enforce. Automated rules
belong in the repository checks rather than in prose. The standards below cover
judgment: naming, dependency boundaries, and API and schema design.

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

- A workspace package (`packages/*`) is imported by its package name, such as
  `@taskome/ui` or `@taskome/config`, never by a relative path that reaches
  across package boundaries (`../../../packages/ui/src/...`).
- Within an app, prefer path aliases over long relative chains once an import crosses more than one directory level.
- `apps/server` uses vertical feature slices under `src/features/<feature>/`.
  Follow its README's route → handler → module → repository dependency direction
  rather than growing a shared controller or generic repository layer.
- Frontend ownership differs between `apps/web` and `apps/console`. Before
  moving a route, component, or integration between them, read each app's
  README; do not infer one app's conventions from the other.

## API and schema design

- `apps/server`'s REST contract is declared with Zod and `createRoute`, then
  exposed at `/openapi.json`. Contract changes include an HTTP test through
  `app.request()`; do not maintain a second hand-written response schema.

The Tool/Job/Attempt REST and MCP API doesn't exist in `apps/server` yet. The
implemented business feature slice is `projects`. Once the compute API exists,
this section should gain its conventions (curated parameter contracts,
Params/Result schema shape); until then, that remains a target-architecture
question for
[`architecture/components/tool-runtime.md`](../architecture/components/tool-runtime.md),
not a coding standard for code that doesn't exist.

## Comments

Default to no comment. Add one when the reason for the code is non-obvious and
the implementation cannot make that reason clear on its own.

## Not covered here

- **Error handling** — two different things, one implemented and one not:
  `apps/server`'s HTTP-level `application/problem+json` convention (RFC 9457)
  is documented in its own README; follow it, don't re-derive a competing
  convention. `runtime_toolkit`'s Attempt `failure_kind` classification
  doesn't exist yet — see [`architecture/components/tool-runtime.md`](../architecture/components/tool-runtime.md)
  for its target design, and add a convention here once that package exists.
- **Where a component file lives** — the owning app's README defines the local
  ownership boundary. This page keeps only the cross-application rule.
- **Development workflow** — [`CONTRIBUTING.md`](../../CONTRIBUTING.md) covers
  repository setup, verification, commits, and pull requests.

## Related docs

- [`docs/engineering/testing.md`](./testing.md) — test seams and conventions.
- [`docs/engineering/observability.md`](./observability.md) — `evlog` as
  `apps/server`'s logger, and the correlation fields its request logging
  already carries.
- [`architecture/components/tool-runtime.md`](../architecture/components/tool-runtime.md) —
  the target Tool/Job API and schema design this page defers until it's implemented.
