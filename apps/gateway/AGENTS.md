# Gateway responsibility

`apps/gateway` is the computing-platform backend. It owns platform-domain data and exposes each Task through both the curated `/v1` REST API and MCP. It does not own authentication data or browser-facing presentation.

## Invariants

- Gateway writes only its `gateway` Postgres schema. Auth tables in `public` belong to Web and are reached through Web's narrow authenticated interfaces, never direct SQL.
- A Task is complete only when its MCP and REST surfaces expose the intended curated configuration together. Keep the two contracts aligned; neither is an optional companion.
- Web browsers reach Gateway only through the Web BFF. Direct REST callers and MCP clients use Gateway's public contracts directly.
- Keep transport in `api`, contracts in `schemas`, persistence in `models` and `repositories`, and business orchestration in `services`.

## Contract and persistence changes

- Before changing public REST, MCP, authentication, data ownership, or Web-facing data flows, read the applicable ADR in `../../docs/adr/`, especially [ADR-0001](../../docs/adr/0001-schema-per-service-data-ownership.md) and [ADR-0002](../../docs/adr/0002-identity-and-access-channels.md).
- A `/v1` contract change requires running root `mise run openapi:generate`, which updates the checked-in OpenAPI input and regenerates both TypeScript and Go clients; do not preserve stale client behavior with a hand-written compatibility layer.
- Model changes require a reviewed Alembic revision. Schema construction goes through the migration path described in `README.md`; tests build the schema by running that same migration path, not `metadata.create_all` — see [`docs/engineering/testing.md`](../../docs/engineering/testing.md) for why.

## Completion

- Cover changed behavior through Gateway's public REST or MCP seams, with focused unit coverage for internal boundaries where useful.
- Run the Gateway checks documented in `README.md`; changes to public contracts also leave the generated API client current.
