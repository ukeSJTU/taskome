---
status: accepted
date: 2026-08-15
decision-makers: Taskome maintainers
---

# Schema-per-service data ownership in one shared Postgres instance

## Context and Problem Statement

Web and Gateway are two independently deployed services that both need to persist data — Web owns authentication (users, sessions, API keys), Gateway owns platform data (Input Files today, Jobs once dispatch exists). How should that data be stored and owned so each service's data model can evolve independently, without either service becoming a hidden dependency on the other's internal schema?

## Decision Drivers

- Module boundaries: each service should own its own data outright, per root `AGENTS.md`'s engineering principles.
- Team size: a single small team maintaining two migration histories (Drizzle for TypeScript, Alembic for Python) needs the split to stay simple, not require bridging tooling.
- Today's requirements: v1 is a single-machine deployment (see `constraints.md`) — isolation stronger than convention plus code review isn't yet justified by team size or an actual incident.
- Future readiness: the eventual multi-tenancy/team-sharing feature (`vision.md`'s Future) shouldn't require a storage migration when it lands.

## Considered Options

- One shared Postgres schema, both services read and write any table directly
- Schema-per-service, one shared Postgres instance, cross-service access only through APIs
- Fully separate Postgres instances per service

## Decision Outcome

Chosen option: "Schema-per-service, one shared Postgres instance, cross-service access only through APIs", because it gives each service a real ownership boundary without the operational cost of running and backing up two separate database instances for a single-machine v1 deployment.

Web's schema is Drizzle-managed and holds only auth data. Gateway's schema is Alembic-managed and holds everything else. Neither service queries the other's tables directly or shares a migration history; the one sanctioned path between them is Web's server-side BFF calling Gateway's REST API with a session JWT (see ADR-0009 for the current access-channel authentication decision).

### Consequences

- Good, because each service's schema evolves independently — a Gateway migration can never break Web's auth tables, and vice versa.
- Good, because using two different, non-bridged migration tools (Drizzle vs. Alembic) makes an accidental cross-schema write structurally awkward, not just against policy.
- Good, because it doesn't foreclose later multi-tenancy work — ownership-agnostic identifiers (a plain `owner_user_id` string, not a foreign key) work the same way regardless of how many organizations or teams eventually share the instance.
- Bad, because the ownership boundary is enforced by convention and code review, not by the database itself — no separate Postgres roles or grants stop a bug from writing across the boundary.
- Bad, because one shared Postgres instance is a single point of failure for both services at once — see `risks.md`.

### Confirmation

Code review: a pull request that adds a cross-schema foreign key, a raw SQL query against the other service's schema, or a shared migration should be rejected. `InputFile.owner_user_id` (Gateway's schema) storing Web's user ID as a plain string with no foreign key, rather than a real reference, is the existing pattern to point to.

## Pros and Cons of the Options

### One shared Postgres schema

Both services read and write any table in one schema.

- Good, because there's only one migration history to maintain.
- Bad, because there's no real ownership boundary — either service can depend on the internal shape of the other's tables, which is exactly the coupling this decision exists to prevent.
- Bad, because Web (TypeScript/Drizzle) and Gateway (Python/Alembic) would need a shared migration tool, which neither stack naturally provides.

### Schema-per-service, one shared instance (chosen)

- Good, because it keeps operational cost low — one Postgres instance to run and back up — while still giving each service a real, if convention-enforced, boundary.
- Good, because it matches each service's own migration tooling without bridging work.
- Neutral, because the boundary depends on discipline (code review), not a database-level guarantee.

### Fully separate Postgres instances

- Good, because it gives the strongest possible isolation — no shared failure domain, no possibility of an accidental cross-schema query.
- Bad, because it doubles the operational burden (two instances to run, back up, monitor) for a single small team on a single-machine v1 deployment, without a concrete problem it solves today.

## More Information

See [`docs/architecture/data.md`](../architecture/data.md) for the current table-by-table breakdown, and [`docs/architecture/risks.md`](../architecture/risks.md) for the single-Postgres-instance risk this decision accepts. Revisit if the single shared instance becomes a demonstrated availability problem, or when real multi-tenancy needs per-tenant isolation stronger than an indexed column.
