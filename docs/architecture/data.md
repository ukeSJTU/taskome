# Data

[`containers.md`](./containers.md) established that Web and Gateway share one Postgres instance, split by schema, with no cross-schema access. This page goes one level deeper: what tables actually exist in each schema, and how Input Files get deleted.

## Web's schema (Drizzle-managed, auth only)

| Table                                       | Purpose                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `user`                                      | Core user identity                                                      |
| `session`                                   | Active login sessions                                                   |
| `account`                                   | Linked credential/OAuth provider accounts                               |
| `verification`                              | Email/OTP verification tokens                                           |
| `apikey`                                    | Personal API Keys                                                       |
| `jwks`                                      | JWT signing keypairs                                                    |
| `oauth_client`                              | OAuth clients Web issues as an OIDC provider (MCP Agents register here) |
| `oauth_refresh_token`, `oauth_access_token` | MCP OAuth tokens                                                        |
| `oauth_consent`                             | User consent grants per OAuth client                                    |
| `two_factor`                                | TOTP secrets and backup codes                                           |

Every foreign key here is intra-schema. Web owns all of it, and nothing outside Web queries these tables directly.

## Gateway's schema (Alembic-managed, everything else)

Today, that "everything else" is `input_files` (`id`, `owner_user_id`, `original_filename`, `created_at`, `deleted_at`) and `jobs` (`id`, `owner_user_id`, `task_server_name`, `task_name`, `params`, `params_schema_version`, `status`, `result`, `error_detail`, `created_at`, `updated_at`).

> **Status note (delete once built):** [ADR-0008](../adr/0008-taskiq-ray-async-job-dispatch.md) adds a `last_heartbeat_at` column to `jobs`, touched every ~20s by the Gateway Worker while a dispatch call is in flight — the signal a `running` Job's staleness check reads to tell a dead worker from one still legitimately working. That column doesn't exist yet; today's `running` staleness check is a flat time-since-`updated_at` threshold, not a heartbeat.

`owner_user_id` stores the Web-issued user ID as a plain string — there's no foreign key to Web's `user` table, because a real cross-schema foreign key isn't possible here (separate schemas, separate migration tools). Ownership is enforced entirely at the application layer: every query on `input_files` filters by the caller's `owner_user_id`, resolved from their verified `Principal` (see [`security.md`](./security.md)), never from a database join.

## Retention and deletion

Deleting an Input File is a two-step, ordered action: the Postgres row is soft-deleted first (`deleted_at` set, row kept as a record), then the underlying object in SeaweedFS is hard-deleted. So the "soft" delete is a tombstone for bookkeeping — a deleted file is invisible to any further download the moment it's marked deleted — not a recovery mechanism; the bytes are actually gone by the time the delete call returns. There's no scheduled cleanup job today, because there's nothing left to clean up once the storage object is already removed at delete time.

Presigned upload and download URLs both expire after 15 minutes. Upload URLs are additionally bound to an exact `Content-Length` and refuse to overwrite an existing object.

## Related docs

- [`containers.md`](./containers.md) — the schema-per-owner split this page details.
- [`security.md`](./security.md) — how `owner_user_id` gets resolved from a request.
- [`integrations.md`](./integrations.md) — how Input Files move through SeaweedFS.
- [`docs/adr/0005-seaweedfs-storage-and-presigned-urls.md`](../adr/0005-seaweedfs-storage-and-presigned-urls.md) — the storage and presigned-URL decisions behind this.
- [`docs/adr/0008-taskiq-ray-async-job-dispatch.md`](../adr/0008-taskiq-ray-async-job-dispatch.md) — the `last_heartbeat_at` column and the staleness check that reads it.
