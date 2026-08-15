# Deployment

How Taskome actually runs, in both environments, and the one hard scaling limit worth knowing before you touch a Task Server's process model.

This page doesn't repeat [`containers.md`](./containers.md)'s topology diagram — that diagram already is the deployment shape. This page covers what that diagram doesn't: which compose file brings up what, how a release happens, and where the scaling limits are.

## Environments

Two Docker Compose files, layered:

- **`compose.yml`** — the dev-support base. Backing services only: Postgres, the taskiq Redis broker, SeaweedFS, and a disposable local OpenTelemetry viewer. Web, Gateway, and Docs are expected to run natively against these (see [`docs/engineering/local-development.md`](../engineering/local-development.md) for the actual commands) — this file alone is not a full running Taskome.
- **`compose.prod.yml`** — layered on top of `compose.yml` (`docker compose -f compose.yml -f compose.prod.yml up`), adding Caddy, Web, Docs, Gateway, a one-shot `gateway-migrate` job, and Ray's head node. This is the full, production-shaped stack — it's also what `mise run prod:up` runs locally for a production rehearsal.

Startup order is enforced through Compose health checks, not assumed: `gateway-migrate` waits for Postgres, runs the Alembic migration, and exits; Gateway waits for `gateway-migrate` to finish successfully and for Redis to be healthy; Caddy waits for Web, Docs, and Gateway to all report healthy before accepting traffic.

## Configuration differences

Dev (`.env.example`) only has two optional overrides — a Postgres password and SeaweedFS's allowed CORS origin. Production (`.env.production.example`) requires real values for Caddy's public origins (`WEB_ADDRESS`, `DOCS_ADDRESS`, `API_ADDRESS`), the auth service URLs, and two secrets that must not be reused across services — see [`security.md`](./security.md) for why.

## Release process

There isn't one yet, beyond `mise run prod:up`. No CI job deploys anything (see [`docs/engineering/ci-cd.md`](../engineering/ci-cd.md)), there's no version-tagging convention (no git tags, every package sits at a pre-1.0 placeholder version), and no changelog. A release today is an operator running `mise run prod:up` by hand.

## Known scaling limit: Task Servers are single-process, single-replica

Every Task Server (today, `task-fpocket`) starts with `--workers 1`, and must run as exactly one replica — no load balancer in front of multiple instances. This isn't a soft recommendation; it's load-bearing:

- A Task Server tracks in-flight and completed Job IDs in memory, guarded by an in-process lock. That state doesn't exist anywhere else, so a second process or replica can't see what the first one is doing — duplicate-Job protection breaks the moment you scale past one.
- Output publication's non-overwrite check relies on the same single-process assumption, because SeaweedFS doesn't enforce S3's conditional-PUT semantics — a second replica racing the first could silently duplicate or clobber an output.
- A forced shutdown can interrupt a Job mid-run and leave an orphaned output behind. There's no automatic retry — a caller has to submit a new Job.

This is a deliberate, temporary shape: it's meant to be replaced, not extended, once Gateway's queue-and-dispatch design (see `containers.md`'s Job execution section) actually exists. Gateway itself has no equivalent constraint — it runs multiple worker processes by default today, backed by Postgres and Redis rather than in-memory state.

## Related docs

- [`containers.md`](./containers.md) — the deployment topology diagram.
- [`security.md`](./security.md) — the secrets this page's config differences reference.
- [`docs/engineering/local-development.md`](../engineering/local-development.md) — the day-to-day commands for running this locally.
- [`docs/engineering/ci-cd.md`](../engineering/ci-cd.md) — what CI does and doesn't do around deployment.
