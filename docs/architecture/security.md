# Security

This page covers Taskome's identity model — how a request from any of the three Access Channels ends up as one internal notion of "who's asking" — plus where secrets live and what's rate-limited today. For the channels themselves, see [`context.md`](./context.md); for which container does what with this model, see [`containers.md`](./containers.md).

## Identity model

Every request, regardless of which Access Channel it came through, resolves to one internal `Principal` before Gateway does anything else with it. Three credential kinds map to that one `Principal`:

| Credential kind        | Used by                        | Verified how                                                        |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------- |
| Session JWT            | Web App (via its BFF)          | Gateway verifies against Web's JWKS endpoint                        |
| MCP OAuth access token | MCP Agent                      | Gateway verifies against the same JWKS endpoint, different audience |
| Personal API Key       | CLI, external scripts/services | Gateway calls Web's internal verification endpoint                  |

This is Gateway's core job as the identity boundary (see [`overview.md`](./overview.md)'s Core principles) — nothing downstream of that resolution has to branch on how the caller connected.

### JWT verification

Web signs both session JWTs and MCP OAuth access tokens using better-auth's `jwt` plugin (EdDSA). Gateway never holds a shared signing secret — it fetches Web's JWKS endpoint and verifies signatures against the public keys there. What separates a session JWT from an MCP OAuth token isn't the signing mechanism, it's the **audience**: session JWTs are scoped to Gateway's REST resource, MCP OAuth tokens are scoped to Gateway's MCP resource. Gateway's verifier checks audience as well as signature, so a token minted for one surface can't be replayed against the other.

The MCP OAuth flow itself supports only the `authorization_code` grant. Dynamic client registration is allowed, including from unauthenticated clients, rate-limited to 5 requests per 60 seconds.

### Personal API Key verification

Gateway doesn't verify Personal API Keys itself — it POSTs the raw key to a narrow internal endpoint on Web, HMAC-signing the request (a shared secret plus a timestamp, checked against a 300-second max age with a constant-time comparison) so the call can't be replayed or spoofed. Web looks the key up through better-auth and returns whether it's active and which user it belongs to.

Two things worth knowing if you're relying on this: Personal API Keys **never expire** — revocation is only ever explicit (disabling the key), there's no default TTL — and this verification path has its own replay protection (the HMAC/timestamp check) but no separate rate limit; better-auth's plugin-level rate limiting is explicitly turned off for this key type.

## Secrets management

Secrets are plain environment variables today — no vault, no Docker secrets. Each service gets its own `.env` file; `.env.production.example` at the repo root lists what a real production deploy needs, including two secrets that must **not** be reused across services (the auth signing secret and the Gateway↔Web internal HMAC secret) because reusing either would let a compromise of one service forge requests as the other.

## Rate limiting

Better-auth's global rate limiting covers its own routes (login, session, OAuth) by default. Personal API Key verification opts out of that (it has its own replay protection instead, described above). Gateway itself has no rate limiting of its own today — nothing in `apps/gateway` limits request rate beyond what Web's auth layer already covers upstream.

## Related docs

- [`context.md`](./context.md) — the three Access Channels this identity model serves.
- [`containers.md`](./containers.md) — which container does what.
- [`overview.md`](./overview.md) — why identity resolution is centralized in Gateway.
- `docs/adr/` — the access-channels and JWT-auth decisions behind this model, once renumbered.
