# Docs responsibility

`apps/docs` is the static public documentation site. It presents deliberately public information and has no Gateway access or dependency on internal platform data.

## Invariants

- Keep internal operational details, credentials, private endpoints, and team-specific workflows out of published content unless their publication is explicitly part of the task.
- Use `@taskome/ui` for shared presentation primitives rather than duplicating the Web app's product UI or data-access code.

## Completion

- Verify changed content renders through the site's build/type-check path and that navigation and links still resolve.
