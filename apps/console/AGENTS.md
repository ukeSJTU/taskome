# Console application

## Read by change type

- **Product boundary:** Before moving pages, authentication, or domain behavior
  between applications, read the introduction in [`README.md`](README.md) and
  the Web App responsibility in
  [`docs/architecture/containers.md`](../../docs/architecture/containers.md).
- **Routes and UI:** Before adding routes or deciding whether a component is
  local or shared, read [`README.md`](README.md#work-in-the-application).

## Invariants

- Keep authorization decisions on the server; route loading may protect browser
  navigation but does not become an authorization boundary.
- Route-level pending, error, and not-found behavior uses the existing console
  route-state components so navigation failures remain consistent.

## Completion

Run `mise run //apps/console:check` for every console change and
`mise run //apps/console:build` when routes, build configuration, or production
behavior changes. Update this app's README when its environment, run path, or
ownership boundary changes.
