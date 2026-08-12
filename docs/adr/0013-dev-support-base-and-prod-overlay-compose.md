---
status: accepted
---

# Split the deploy compose file into a dev-support base and a prod overlay, superseding ADR-0008's single file

ADR-0008 committed to one docker-compose file used unchanged from a local dev machine through to the eventual GPU server. In practice, day-to-day development runs `web` and `gateway` natively (`pnpm dev` / `fastapi dev`) for hot reload, never in containers, and has no GPU to reserve — so a local run only ever needs to start supporting services (Postgres, SeaweedFS, a local OTel viewer — see ADR-0014), never the app containers or GPU-bound services. The two stages turned out to need different service sets, not just different config values for the same set, so one file stopped fitting cleanly.

`compose.yml` (repo root, renamed from `docker-compose.yml`) now holds only the dev-support services. `compose.prod.yml` is an overlay adding `web`, `gateway`, and — once they exist — GPU-bound Task Servers plus the Ray head node (ADR-0006), started together via `docker compose -f compose.yml -f compose.prod.yml`. We didn't name the overlay `compose.override.yml`: Compose auto-merges a file with that exact name into a bare `docker compose up`, which is normally used for local personal overrides on top of a prod-shaped base — using it the other way round would mean a bare `docker compose up` silently pulls in GPU reservations and prod-only services by default, which is the opposite of what we want. We also considered a single file with Compose `profiles:` instead of two files, but rejected it: prod-only concerns (GPU device reservations, reverse-proxy config) would stay physically mixed into the same file as the dev-support services, where the two-file split keeps them apart.

`infra/` holds compose fragments (`seaweedfs.yml`, `otel-gui.yml`, `ray.yml`) `include:`-ed from whichever file actually needs them. SeaweedFS and the OTel viewer are dev-relevant (a natively-run gateway needs a real object store to develop the Input File flow from ADR-0011 against) and are included from the base `compose.yml`. Ray is included only from `compose.prod.yml` — it has no consumer at all until a Task Server exists (ADR-0001), and even once one does, dev machines aren't expected to have the GPUs it schedules.

## Consequences

- mise tasks renamed: `db:start` → `dev:up` (`docker compose up -d`, whatever the base file defines — no service list to maintain as dev-support services are added, e.g. Redis for ADR-0005's Taskiq broker); `docker:build`/`docker:up`/`docker:down`/`docker:logs` → `prod:build`/`prod:up`/`prod:down`/`prod:logs`, each chaining `-f compose.yml -f compose.prod.yml`.
- `apps/web/Dockerfile` and the new `apps/gateway/Dockerfile` are unaffected — this ADR only changes which compose file references them and with what overlay-only config (GPU reservations, prod env).
