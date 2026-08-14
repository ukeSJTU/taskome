# Database package responsibility

`@taskome/db` owns Web's Drizzle-managed authentication schema and its migrations. Gateway domain data belongs to Gateway's separate SQLAlchemy/Alembic ownership.

## Invariants

- Do not add jobs, input files, or other Gateway-owned domain tables here.
- Schema changes update the Drizzle schema and the corresponding reviewed migration together.
- Keep database access and schema exports stable for Web and Auth consumers; do not encode Gateway-specific behavior in this package.

## Completion

- Validate the migration and all affected Web/Auth database behavior through their public seams.
