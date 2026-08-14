# UI package responsibility

`@taskome/ui` provides reusable visual primitives, styles, and interaction utilities for workspace applications. It contains no routes, data fetching, product policy, or Gateway calls.

## Invariants

- Design component APIs around reusable composition rather than application-specific state or route assumptions.
- Preserve accessibility semantics, keyboard behavior, and compatible styling contracts when changing a shared component.
- Keep application copy and data-dependent empty, error, or loading policy in the consuming app unless it is genuinely reusable UI behavior.

## Completion

- Validate affected consuming applications as well as the component's own type and interaction behavior.
