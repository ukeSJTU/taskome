# Security

This page covers Taskome's identity model — how a request from any of the four Access Channels ends up as one internal notion of "who's asking" — plus where secrets live and what's rate-limited today. For the channels themselves, see [`context.md`](./context.md); for which container does what with this model, see [`containers.md`](./containers.md).

## Identity model

Every request, regardless of which Access Channel it came through, resolves to one internal `Principal` before Gateway does anything else with it. Three credential kinds map to that one `Principal`:

| Credential kind    | Used by                                   | Verified how                                                           |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------------------- |
| Session JWT        | Web App (via its BFF)                     | Gateway verifies against Web's JWKS endpoint                           |
| OAuth access token | MCP Agent; interactive CLI                | Gateway verifies against Web's JWKS endpoint and the resource audience |
| Personal API Key   | CLI automation; external scripts/services | Gateway calls Web's internal verification endpoint                     |

This is Gateway's core job as the identity boundary (see [`overview.md`](./overview.md)'s Core principles) — nothing downstream of that resolution has to branch on how the caller connected.

### JWT verification

Web signs both session JWTs and OAuth access tokens using better-auth's `jwt` plugin (EdDSA). Gateway never holds a shared signing secret — it fetches Web's JWKS endpoint and verifies signatures against the public keys there. The **audience** separates each access token's resource: session JWTs and CLI OAuth tokens are scoped to Gateway's REST resource, while MCP OAuth tokens are scoped to Gateway's MCP resource. Gateway's verifier checks issuer and audience, so an MCP token cannot be replayed against REST, and a REST token cannot be replayed against MCP.

OAuth supports `authorization_code` with S256 PKCE for every public client. MCP Agents continue to use rate-limited dynamic registration; the official CLI is one server-seeded public client and uses a loopback callback. CLI login additionally requests `offline_access` and uses refresh-token rotation. Device Authorization Grant is deliberately deferred. See [ADR-0009](../adr/0009-cli-oauth-login-and-api-key-automation.md).

> **Status note (delete once built):** CLI REST OAuth is the accepted target of ADR-0009, not a live credential path yet. Today Gateway REST accepts a Web session JWT or a Personal API Key; Gateway's OAuth verifier remains MCP-only.

### Personal API Key verification

Gateway doesn't verify Personal API Keys itself — it POSTs the raw key to a narrow internal endpoint on Web, HMAC-signing the request (a shared secret plus a timestamp, checked against a 300-second max age with a constant-time comparison) so the call can't be replayed or spoofed. Web looks the key up through better-auth and returns whether it's active and which user it belongs to.

Two things worth knowing if you're relying on this: Personal API Keys **never expire** — revocation is only ever explicit (disabling the key), there's no default TTL — and this verification path has its own replay protection (the HMAC/timestamp check) but no separate rate limit; better-auth's plugin-level rate limiting is explicitly turned off for this key type.

## Secrets management

Secrets are plain environment variables today — no vault, no Docker secrets. Each service gets its own `.env` file; `.env.production.example` at the repo root lists what a real production deploy needs, including two secrets that must **not** be reused across services (the auth signing secret and the Gateway↔Web internal HMAC secret) because reusing either would let a compromise of one service forge requests as the other.

## Rate limiting

Better-auth's global rate limiting covers its own routes (login, session, OAuth) by default. Personal API Key verification opts out of that (it has its own replay protection instead, described above). Gateway itself has no rate limiting of its own today — nothing in `apps/gateway` limits request rate beyond what Web's auth layer already covers upstream.

## Related docs

- [`context.md`](./context.md) — the four Access Channels this identity model serves.
- [`containers.md`](./containers.md) — which container does what.
- [`overview.md`](./overview.md) — why identity resolution is centralized in Gateway.
- [`docs/adr/0009-cli-oauth-login-and-api-key-automation.md`](../adr/0009-cli-oauth-login-and-api-key-automation.md) — the CLI OAuth and API-key decisions behind this model.
- [`docs/adr/0007-internal-service-hmac-signing.md`](../adr/0007-internal-service-hmac-signing.md) — the Personal API Key verification and internal-signing decision.
