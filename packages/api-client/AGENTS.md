# Gateway API client responsibility

`@taskome/api-client` is the server-side TypeScript client for Gateway's curated REST contract. Its generated code is derived from the checked-in Gateway OpenAPI input.

## Invariants

- Treat `openapi.json`, `orval.config.ts`, and the Gateway contract as the source of truth for generated client code. Do not hand-edit `src/generated/gateway`.
- Browser code does not call this package directly; Web uses it from its server-side BFF boundary.
- Keep the mutator's authentication and error semantics consistent across generated operations.

## Contract changes

- After changing Gateway's public REST contract, update `openapi.json` and regenerate the client with the package's configured generator.
- Resolve an inconvenient generated shape by changing the API contract or generation configuration, not by patching a generated file.

## Completion

- Generated output is current, type-checks, and its Web BFF consumers continue to handle the resulting success and error contract.
