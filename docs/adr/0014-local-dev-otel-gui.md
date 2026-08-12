---
status: accepted
---

# Local dev runs a self-hosted otel-gui viewer; production stays on Axiom (ADR-0010)

ADR-0010 rejected self-hosting an OTel collector/backend for production, weighing the operational cost a team at this stage would take on (its own containers, storage, upgrades) against Axiom's free SaaS tier. That reasoning is about production operations, not local development: one extra ephemeral container a developer runs on their own machine to see traces/logs while coding isn't infrastructure anyone maintains — it's the same category of dev convenience as the Postgres container already used the same way. `compose.yml` (the dev-support base, ADR-0013) therefore includes `infra/otel-gui.yml`, running `ghcr.io/metafab/otel-gui` — zero-config, in-memory, single container, listening on the standard OTLP/HTTP port — so `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` just works for the natively-run `web`/`gateway` processes. This doesn't reopen ADR-0010's production backend choice; a future move to self-hosted Grafana in production, if it happens, is a separate decision.

## Considered and rejected

- **SigNoz** — the initial pick, reversed after further research: as of v0.130.0 it dropped its static `docker-compose.yaml` in favor of a separate `foundryctl` CLI that generates and owns its own compose files (explicitly warns against hand-editing them), which doesn't fit being vendored as an `infra/*.yml include:` fragment the way our other dev-support services are. It also pulls in ClickHouse, ClickHouse-keeper, and its own Postgres — heavier than a local trace viewer needs to be.
- **Uptrace** — still a plain, embeddable docker-compose, but still requires running ClickHouse alongside it for a need this small.
- **Grafana LGTM (Tempo + Loki + Grafana)** — most flexible and closest to a plausible future production stack, but multi-container and the heaviest option; adopting it now would mean carrying that weight for a production decision that hasn't been made.
