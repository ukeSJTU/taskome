---
status: accepted
---

# Gateway schema has exactly one path — Alembic migrations — and integration test fixtures use it too

`db:push` (`scripts/database.py`'s dev-only convenience command, wrapping `metadata.create_all`) is retired, and `apps/gateway/tests/integration`'s Postgres fixture is built by running `alembic upgrade head` instead of hand-rolling its own `create_all` schema setup. Before this, three code paths built the gateway schema independently — `db:push` for local dev, an ad hoc `create_all` inside the one existing integration test, and `alembic upgrade head` for staging/production — with nothing catching drift between them if a developer changed a SQLAlchemy model without generating the matching Alembic revision (`db:revision`'s drift check via `alembic.command.check` exists but was never wired into CI).

Collapsing to one path means integration tests now incidentally verify that the migration chain runs cleanly and matches the models — a missing revision surfaces as a real test failure (missing column, wrong type) instead of silent drift. `db:revision` (disposable-container autogenerate) is unaffected — it's still how a new migration gets written; only `db:push` and the code path it exercised are gone.

## Consequences

Local dev iteration is slower for throwaway schema experiments: changing a model now requires `db:revision` (which itself spins up a disposable Postgres container to autogenerate) before `db:migrate` picks it up, rather than one instant `db:push`. At the time of this decision the gateway schema has only two revisions, so this cost was judged acceptable in exchange for removing the drift risk and one maintained schema-building code path.
