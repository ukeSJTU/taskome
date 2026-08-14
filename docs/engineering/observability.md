# Observability

## Requirements

Every service in this platform must emit traces and structured logs over OpenTelemetry — metrics are deferred for now, not required. Specifically:

- **Traces**: a request that crosses a service boundary (Web BFF → Gateway, Gateway → a Task Server) must be traceable as one flow, not three disconnected logs.
- **Structured logs**: `pino` for TypeScript services, `structlog` for Python services — not ad hoc `console.log`/`print`. A log line without structured fields (request ID, user/principal where applicable) isn't useful for debugging a shared platform.
- **Local parity**: you should be able to see the same shape of trace/log data locally that you'd see in production, without needing production credentials. That's what `otel-gui` is for.

The specific technology choices behind these requirements — why OpenTelemetry, why Axiom for production, why a self-hosted viewer for local dev instead of a hosted one — are architectural decisions, not requirements; see the observability ADRs (`docs/adr/`) for that reasoning. This page assumes those choices and tells you how to work with them.

## Local development: otel-gui

`mise run dev:up` starts `otel-gui` (part of the dev-support stack) at `http://localhost:4318`, dev-only. Web and Gateway are both configured to export traces and logs there when running locally — no extra setup needed once dev-support services are up.

Open [localhost:4318](http://localhost:4318) to browse traces and logs from your local session. This is disposable — it doesn't persist across `mise run dev:down`, and it isn't the same data path production uses.

## Production: Axiom

Production traces and logs export to Axiom rather than the local viewer. You need Axiom access (ask whoever manages the org's Axiom account) to view them — this page doesn't cover requesting access, since that's an organizational process, not a technical one.

## Related docs

- [`docs/engineering/local-development.md`](./local-development.md) — starting the dev-support stack that includes `otel-gui`.
- `docs/adr/` — why OTel, why Axiom, why a local viewer (once those ADRs are written).
