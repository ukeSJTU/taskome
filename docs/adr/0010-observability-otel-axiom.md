# Instrument web and gateway with OpenTelemetry (traces + logs), export to Axiom; job-status data is a separate, deferred concern

This covers **engineering observability** only — traces and structured logs that help developers debug the running system. It's a distinct concern from **product observability** — the job lifecycle data (`queued`/`running`/`ok`/`error`, per ADR-0005) a future customer-facing dashboard would show for task status and runtime. The two intersect at exactly one point, noted below; conflating them further would mean debugging telemetry and durable product data compete for the same schema and retention tradeoffs.

**Scope includes the production Docker Compose deployment.** `apps/web` is built as a standalone Docker image and writes structured JSON to standard output in CI and production. OTLP export remains opt-in through standard OpenTelemetry environment variables, so the same image works without an external backend and a collector or SaaS destination can change without an instrumentation rewrite.

**Traces and structured logs first; metrics deferred.** Metrics are only useful once you know which numbers matter, and we don't have that signal yet. Traces give end-to-end visibility across the web → gateway → Task Server hops; logs give the detail traces don't carry. Both are standard OTLP, so nothing here is Axiom-specific.

**Logging libraries: `pino` for TypeScript services, `structlog` for Python services.** `pino` is the mature choice for `apps/web` with an established OTel log-bridge story, but needs `pino-pretty` for readable dev-console output plus an OTel transport/instrumentation plugin — it doesn't do structured-to-OTLP itself out of the box. `apps/gateway` currently has zero dependencies (`pyproject.toml`: `dependencies = []`), so `structlog` is a green-field addition; the lighter alternative (stdlib `logging` + OTel's `LoggingHandler`, no extra dependency) is available if `structlog`'s ergonomics turn out not to be worth the package.

**Backend: Axiom.** We're not self-hosting a collector stack (Grafana/Tempo/Loki/Prometheus or SigNoz Community Edition) — that's real operational surface (its own containers, storage, upgrades) for a team at this stage, so we picked a SaaS free tier instead. Considered and rejected:

- **Honeycomb** — deepest OTel pedigree and longest free retention (60 days), kept as the fallback if trace-analysis depth becomes the bottleneck, but the query model has a steeper learning curve for a team without prior observability experience.
- **Grafana Cloud** — only option bundling logs+traces+metrics free indefinitely, but shortest free retention (14 days) and a UI/DX reputation that trails the above two.
- **Better Stack** — praised UX, but its free tier's 3-day retention is too short to be useful past live debugging.
- **New Relic** — largest raw ingest cap, but free tier grants only one full-access seat, awkward for a growing team.
- **SigNoz Cloud** — no meaningful free hosted tier (paid plans only); self-hosting it was already ruled out above.
- **Baselime** and **Highlight.io** — both discontinued as standalone products (folded into Cloudflare and LaunchDarkly respectively), not viable to adopt new.
- **Cloudflare Workers Observability** — not a general-purpose OTLP sink; it only captures telemetry from code actually running on Cloudflare Workers, which nothing here does (deployment is docker-compose per ADR-0008).

Since every candidate speaks standard OTLP, switching later is an exporter-endpoint change, not an instrumentation rewrite.

**No shared `packages/observability` yet.** `apps/web` is currently the only TypeScript runtime service — `packages/*` are libraries, not services — so OTel SDK setup (resource attributes, exporter config, log formatting) is configured directly inside `apps/web` rather than extracted into a shared package for a hypothetical second consumer. `apps/gateway`'s Python setup is independent regardless, since it can't share a TS package. Extract a shared package if and when a second TS service needs the same setup.

**The one point where the two concerns touch**: once a `jobs` table exists (it doesn't yet — see ADR-0005's description vs. the current absence of the table in code), its schema should reserve a `trace_id` column so a specific job's dashboard entry can be correlated to its distributed trace during debugging. This is a note for whoever designs that schema, not a decision made here — full job-status schema design (timestamps, retry counts, error detail) and how it's synced to a frontend (polling vs. push) are out of scope for this ADR. What is decided now: that table will be owned exclusively by the gateway, with `web` reading job status through the gateway's REST API rather than querying Postgres directly — consistent with the encapsulation ADR-0002/0003/0007 already establish for gateway-owned state.
