---
status: accepted
---

# Docs site as a separate deployable (`apps/docs`), with a subdomain exception to ADR-0019

The platform needs a public docs site (Getting Started + per-Task usage guides, modeled on tamarind.bio's `docs.tamarind.bio`) that ships on its own release cadence and doesn't touch gateway. We're adding `apps/docs` — a separate Fumadocs (Next.js) app in the monorepo — rather than a `(docs)` route group inside `apps/web`. This is a deliberate exception to AGENTS.md's "`apps/web` is the only user-facing deployable": that principle exists to stop a second frontend from bypassing the BFF and hitting `apps/gateway` directly, and `apps/docs` is static content with no gateway access, so the concern it guards against doesn't apply here.

It's also an explicit exception to ADR-0019's single-domain, path-routed convention: `apps/docs` is routed on its own subdomain, `docs.taskome.com`, added as a new Caddyfile block (ADR-0019 already anticipated a third publicly-routed service needing manual Caddyfile config). Everything else — `apps/web`, `apps/gateway`/MCP — stays on the primary domain, path-routed, per ADR-0019; `mcp.taskome.com` and `api.taskome.com` were considered and explicitly rejected for now.

## Considered options

- Embedding docs as a `(docs)` route group in `apps/web` — rejected: couples the docs release cycle and runtime to the authenticated app, and Fumadocs' own routing would sit awkwardly next to the existing `(app)`/`(public)`/`(auth)` route groups.
- A hosted docs SaaS (e.g. Mintlify) — rejected: a new vendor triggers the Licensing gate (AGENTS.md) for no clear benefit over self-hosted Fumadocs, which is OSS with no such gate and already fits the Next.js/monorepo stack.

## Consequences

- `docs.taskome.com` needs its own DNS record; Caddy still issues its cert automatically (no wildcard/DNS-01 setup needed).
- Content is public (no auth), English-only, hand-authored MDX, with Fumadocs' built-in `llms.txt` generation left on.
- Tool Reference pages are maintained by convention (code review should catch a Task's parameter schema changing without its docs page following) — no generation pipeline yet; revisit if drift becomes a real problem.
