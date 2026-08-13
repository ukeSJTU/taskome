---
status: accepted
---

# Use Caddy as the production reverse proxy, path-routed on a single domain

`infra/proxy/README.md` was a placeholder: no reverse-proxy software, domain, or certificate approach had been decided. `compose.prod.yml` binds `web` (3001) and `gateway` (8000) straight to host ports with no proxy in front, even though `apps/gateway/README.md` already assumes "TLS termination is expected at the reverse proxy." This ADR settles the proxy software choice; the actual domain and target machine are still pending (tracked separately — a domain will be registered once the base implementation exists).

We chose **Caddy**, not nginx or Traefik. The deciding constraints: deployment is a single self-managed machine via Docker Compose (ADR-0008/ADR-0013), there's no dedicated ops team to carry nginx's manual ACME/certbot setup or Traefik's routers/entrypoints/middlewares model, and the topology is a fixed pair of services — `apps/web` and `apps/gateway` — routed by path on one public domain (`/mcp` to gateway's MCP Streamable HTTP endpoint at `apps/gateway`'s `/mcp`, everything else to `apps/web`), not split across subdomains. A single domain means one certificate and one DNS record instead of one per service. The domain will be public (app-level auth controls access, not network isolation), so Caddy's default automatic ACME (HTTP-01) needs no extra configuration. Caddy also doesn't buffer proxied responses by default, which matters because MCP Streamable HTTP holds long-lived streaming connections that a misconfigured buffering proxy would break.

Traefik was rejected specifically for its Docker-label-based service auto-discovery: that only pays off with a changing/dynamic service set, and this one is fixed and defined statically in `compose.prod.yml`. nginx was rejected because automatic HTTPS isn't native to it (needs certbot or an nginx-proxy + acme-companion sidecar) and correct streaming behavior requires manually tuning `proxy_buffering off` / `proxy_http_version 1.1` — both are exactly the kind of manual, easy-to-get-wrong config a team without dedicated ops shouldn't have to carry.

Two things stay out of the proxy's scope by design: file uploads go straight to SeaweedFS via presigned URLs (ADR-0011) and never transit the proxy, so it needs no special body-size handling; and the Ray dashboard (`infra/ray.yml`) is intentionally bound to `127.0.0.1:8265` with no auth of its own, so it's never routed publicly and isn't one of the services Caddy fronts.

## Consequences

- `infra/proxy/` will hold a `Caddyfile`, not an nginx.conf or Traefik dynamic config, once the target machine and domain are set.
- Adding a third publicly-routed service later means adding a path/host block to the Caddyfile by hand — there's no auto-discovery, which is an accepted tradeoff given the current fixed two-service topology.
