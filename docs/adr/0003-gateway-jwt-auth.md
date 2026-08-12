# Gateway authenticates all callers with one JWT verifier against better-auth's JWKS

Both the web app (via better-auth's `jwt` plugin, minted per logged-in session) and external MCP agents (via `@better-auth/oauth-provider`) present JWT-formatted, JWKS-verifiable access tokens signed by the same better-auth instance. The gateway validates both with a single `JWTVerifier` against `/api/auth/jwks` — one code path regardless of caller type.

We deliberately don't pass an OAuth `resource` parameter (RFC 8707 audience binding) when minting MCP tokens, since that forces better-auth to issue opaque tokens instead, requiring `/oauth2/introspect` calls that currently have no Python client and a known bug when the introspecting client differs from the issuing client ([better-auth#8267](https://github.com/better-auth/better-auth/issues/8267)). Revisit once the gateway is no longer the only resource server.
