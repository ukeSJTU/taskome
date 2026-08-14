# Package responsibility

`packages/*` contains reusable workspace libraries. A package provides a narrow capability to its consumers; it does not become an alternate application layer.

## Invariants

- Keep application routing, browser request handling, and Gateway business orchestration in their owning apps.
- Preserve each package's public export boundary. Consumers depend on exported entry points, not package-internal paths.
- Add a cross-package dependency only when the shared capability cannot live in the consumer or its existing owner without duplication.

## Completion

- Update public types and affected consumers together, then run the package and consumer checks needed to validate the changed export boundary.
