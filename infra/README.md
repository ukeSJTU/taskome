# infra/

Shared infrastructure that doesn't belong to any single app under `apps/`. Compose fragments here are `include:`-d from the root `compose.yml` (dev-support base) or `compose.prod.yml` (prod overlay) — see [`docs/architecture/deployment.md`](../docs/architecture/deployment.md).

- `seaweedfs.yml` — S3-compatible object store ([ADR-0005](../docs/adr/0005-seaweedfs-storage-and-presigned-urls.md)). Dev + prod, included from `compose.yml`: a natively-run gateway needs a real object store to develop the Input File flow against. `seaweedfs-s3-config.json` holds one dev-wide identity with full access — a placeholder, not the per-service least-privilege credentials [ADR-0007](../docs/adr/0007-internal-service-hmac-signing.md) calls for; split it into scoped identities (one per Task Server, one for the gateway's `uploads/` prefix) once those consumers actually exist.

SeaweedFS is configured for browser-direct presigned PUT/GET requests. The
compose default allows both the native local Web origin at
`http://localhost:3000` and the Caddy-fronted local rehearsal at
`http://localhost`; production deployments must override
`SEAWEEDFS_ALLOWED_ORIGINS` with the exact comma-separated web origins they
serve, then verify an `OPTIONS` preflight against a presigned URL before
exposing the upload flow.

- `otel-gui.yml` — local trace/log viewer. Dev only, included from `compose.yml`. Production observability stays on Axiom — see [`docs/engineering/observability.md`](../docs/engineering/observability.md).
- `redis.yml` — the internal Redis instance for the taskiq durable Job queue (see [ADR-0004](../docs/adr/0004-gateway-owned-job-dispatch.md)), checked by Gateway readiness. It persists Streams with AOF (`everysec`) and rejects writes rather than evicting queued work. The unused rate-limit-specific instance was removed with the deferred rate-limiting scaffold.
- `ray.yml` — Ray head node for GPU/CPU scheduling ([ADR-0004](../docs/adr/0004-gateway-owned-job-dispatch.md)). Prod only, included from `compose.prod.yml` — no consumer until Gateway's dispatch path exists (see the status note in [`docs/architecture/containers.md`](../docs/architecture/containers.md)), and dev machines aren't expected to have GPUs regardless.
- `proxy/` — Caddy reverse proxy and TLS termination for the three-host production edge. It exposes Web and Docs by host, restricts the API host to the public Gateway surfaces, and includes a disposable routing smoke harness.
- `provisioning/` — setup scripts for the eventual GPU server. **Placeholder** — no target machine exists yet.
