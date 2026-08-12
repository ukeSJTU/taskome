# infra/

Shared infrastructure that doesn't belong to any single app under `apps/`. Compose fragments here are `include:`-d from the root `compose.yml` (dev-support base) or `compose.prod.yml` (prod overlay) — see [ADR-0013](../docs/adr/0013-dev-support-base-and-prod-overlay-compose.md).

- `seaweedfs.yml` — S3-compatible object store ([ADR-0004](../docs/adr/0004-object-storage-seaweedfs.md)). Dev + prod, included from `compose.yml`: a natively-run gateway needs a real object store to develop the Input File flow ([ADR-0011](../docs/adr/0011-input-file-transfer-via-presigned-urls.md)) against. `seaweedfs-s3-config.json` holds one dev-wide identity with full access — a placeholder, not the per-service least-privilege credentials [ADR-0009](../docs/adr/0009-secrets-and-internal-webhook-auth.md) calls for; split it into scoped identities (one per Task Server, one for the gateway's `uploads/` prefix) once those consumers actually exist.
- `otel-gui.yml` — local trace/log viewer ([ADR-0014](../docs/adr/0014-local-dev-otel-gui.md)). Dev only, included from `compose.yml`. Production observability stays on Axiom per [ADR-0010](../docs/adr/0010-observability-otel-axiom.md).
- `ray.yml` — Ray head node for GPU/CPU scheduling ([ADR-0006](../docs/adr/0006-ray-shared-gpu-scheduling.md)). Prod only, included from `compose.prod.yml` — no consumer until a Task Server exists ([ADR-0001](../docs/adr/0001-isolate-task-servers.md)), and dev machines aren't expected to have GPUs regardless.
- `proxy/` — reverse proxy / TLS termination for production. **Placeholder** — no target machine, domain, or certificate approach decided yet.
- `provisioning/` — setup scripts for the eventual GPU server. **Placeholder** — no target machine exists yet.
