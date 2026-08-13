---
status: accepted
---

# API reference lives in `apps/web` (authenticated), not `apps/docs`; spec curation happens in gateway

The interactive REST API reference (rendered with Scalar) lives inside `apps/web`'s authenticated `(app)` route group, not on the public `apps/docs` site — mirroring tamarind.bio, which splits general docs (`docs.tamarind.bio`) from its in-app API reference (`app.tamarind.bio/api-docs`). API reference content is expected to grow alongside session-scoped concerns (API key management, if that ever lands) that need auth, while Getting Started/Tool Reference content doesn't, so keeping it behind login now avoids a later split.

Scalar renders the same checked-in `openapi.json` that ADR-0012 already specifies for `packages/api-client` codegen. `apps/gateway` is responsible for excluding non-curated fields/endpoints from that exported spec — the docs layer does no filtering of its own — so the same curation that shapes MCP/REST parameters (AGENTS.md: "a curated subset of the underlying tool's real config") governs what the API reference shows, and nothing uncurated can leak through by rendering the raw spec.

## Consequences

- This documents the existing BFF-mediated REST surface, not a new public API. Direct external REST access (a script authenticating with an API key straight to `apps/gateway`, bypassing `apps/web`) is explicitly out of scope here — it would need a new auth primitive (API keys) on gateway, deferred to a separate task.
- Because the reference is gated by the existing web session, it doesn't need its own auth story.
- Scalar's "try it" request-sending feature starts disabled — enabling it means deciding how it authenticates, which is part of the deferred API key work.
