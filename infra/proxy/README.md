# Production edge

Caddy terminates TLS and routes the three public hosts without exposing an
application container directly:

| Host               | Public surface                                                         | Upstream       |
| ------------------ | ---------------------------------------------------------------------- | -------------- |
| `example.com`      | all paths                                                              | `web:3000`     |
| `docs.example.com` | all paths                                                              | `docs:3001`    |
| `api.example.com`  | `/v1`, `/v1/*`, `/mcp`, `/mcp/*`, protected-resource discovery for MCP | `gateway:8000` |

Every other path on the API host returns Caddy's `404` without reaching Gateway.
That keeps `/scalar`, `/openapi.json`, `/health/*`, `/api/auth/*`, and
`/internal/*` off the public edge. The former `example.com/mcp` route is not a
compatibility alias; it reaches Web like every other main-site path. Caddy does
not add CORS headers.

The checked-in addresses default to the example HTTPS hosts. The Compose overlay
sets localhost development defaults and a production `.env` overrides them. For
a real deployment, point DNS for all three hosts at the machine, copy
`.env.production.example` to the repository root as `.env`, replace its secret
placeholders, and populate the app-specific `.env` files from their checked-in
examples (database, object storage, and observability settings). Then start the
stack:

```bash
mise run prod:up
```

Caddy obtains and renews the three certificates automatically. Its `/data` and
`/config` directories use named volumes, so certificate state survives container
replacement. MCP Streamable HTTP needs no buffering override because Caddy's
reverse proxy streams responses by default.
