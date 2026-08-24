# Control-plane server

## Read by change type

- **Feature boundaries:** Before changing module responsibilities, read the
  source layout in [`README.md`](README.md) and the module rules in
  [`docs/engineering/coding-standards.md`](../../docs/engineering/coding-standards.md).
- **HTTP behavior:** Before changing routes, schemas, or errors, read the HTTP
  surface in [`README.md`](README.md) and the API contract rules in
  [`docs/engineering/coding-standards.md`](../../docs/engineering/coding-standards.md).
- **Persistence or authentication:** Follow the generation and migration order
  in [`README.md`](README.md).
- **Logging:** Before adding fields or events, read
  [`docs/engineering/observability.md`](../../docs/engineering/observability.md).

## Invariants

- Use Stoker only for small OpenAPI and status helpers; keep application
  contracts in Zod and avoid Stoker's deprecated `oneOf` helpers.

## Completion

Run `mise run //apps/server:check` and `mise run //apps/server:test` for every
server change. Also run `mise run //apps/server:test:integration` when the
change touches authentication, authorization, persistence, migrations, or
runtime database wiring. Review every generated schema and SQL diff before
completion.
