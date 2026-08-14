# Authentication package responsibility

`@taskome/auth` is the Better Auth integration shared by Web's authentication surface. It owns authentication configuration, sessions, OAuth issuance, and the JWT claims Gateway validates; it does not own Gateway domain authorization.

## Invariants

- Keep the REST and MCP resource audiences aligned with Gateway's public `/v1` and `/mcp` resources.
- Authentication data stays in `@taskome/db`'s Web-owned schema. Gateway validates credentials through its own boundary and never becomes an Auth database consumer.
- Treat trusted origins, OAuth client registration, API-key lifecycle, and token claims as security-sensitive contract changes.

## Completion

- Changes to issuance, claims, or OAuth flows include behavior-level coverage and verify the affected Gateway authentication path.
