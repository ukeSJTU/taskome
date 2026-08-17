---
status: accepted
date: 2026-08-17
decision-makers: Taskome maintainers
---

# CLI OAuth login with Personal API Key automation fallback

## Context and Problem Statement

[ADR-0002](./0002-identity-and-access-channels.md) made the CLI share a Direct API Client's long-lived Personal API Key. That is a reasonable credential for an unattended script, but it is a poor default for a human at a terminal: creating, copying, naming, and later revoking a long-lived secret adds friction and increases the chance that it is exposed in shell history or configuration.

Taskome already operates an OAuth authorization server for MCP Agents, but that server only issues tokens for Gateway's MCP resource. Gateway's REST verifier deliberately rejects those tokens. The official CLI needs an interactive, refreshable login for the REST resource without making an MCP token reusable against REST, weakening the Personal API Key path used by automation, or treating every installed CLI as an opaque dynamically registered client.

## Decision Drivers

- Human CLI use should have a browser-based login that does not require handling a Personal API Key.
- Non-interactive scripts and CI need an explicit, stable Personal API Key path.
- Gateway must continue to resolve every accepted credential to the same `Principal`; authorization must not branch through Job or Input File business logic.
- OAuth access tokens must remain bound to the REST or MCP resource so tokens cannot cross surfaces.
- The official CLI is a public native client: it cannot keep a client secret and must use PKCE.
- CLI settings must be inspectable and editable as a configuration file, while credentials remain outside it.
- The first release should be small and production-safe: no Device Authorization Grant, profile system, or self-hosted endpoint UX.

## Considered Options

- Keep Personal API Keys as the CLI's only credential.
- Make the CLI a dynamically registered OAuth client, like an MCP Agent.
- Use one fixed public OAuth client with authorization code + PKCE for interactive login and preserve Personal API Keys for explicit automation.
- Add Device Authorization Grant alongside browser login.

## Decision Outcome

Chosen option: "One fixed public OAuth client with authorization code + PKCE for interactive login and preserve Personal API Keys for explicit automation", because it gives a human the normal native-application login experience while retaining a narrow, reliable credential for unattended callers.

The official CLI is the server-seeded public OAuth client `taskome-cli`. It has no client secret, uses a registered `http://127.0.0.1/callback` loopback redirect, opens the system browser, verifies `state`, and exchanges the returned authorization code using S256 PKCE. A loopback IP callback permits the CLI to choose an ephemeral local port; `localhost` is not used for this registration.

CLI OAuth requests the REST resource only. Web's provider accepts both REST and MCP resource audiences, but chooses the audience from the registered client rather than trusting an arbitrary caller-supplied resource: `taskome-cli` is restricted to REST and dynamically registered MCP clients to MCP. Gateway accepts the resulting OAuth issuer plus REST audience on `/v1`, maps its `sub` and `azp` to a `Principal` with OAuth credential kind, and continues to reject the MCP issuer/audience pair there. Existing session-JWT and Personal-API-Key REST paths remain valid.

The OAuth grant set includes `authorization_code` and `refresh_token`. The CLI requests `offline_access`, receives one-hour access tokens and rotating 30-day refresh tokens, and stores both only in the operating system credential store. `taskome logout` revokes the refresh token when possible and removes the local OAuth entry. The CLI exposes `login --api-key` for a user who deliberately wants to store a Personal API Key locally; `TASKOME_API_KEY` and an explicit API-key selection take precedence for non-interactive automation. Logging out an API Key only removes the local stored copy, never revokes the server-side key that may still be used elsewhere.

The CLI uses a configuration layer backed by Cobra and Viper. `gateway_url` is its first setting. Installed CLI builds use the XDG configuration location and a release-provided Gateway default; repository development uses a checked-in development configuration selected explicitly by the `mise` task. OAuth authorization-server discovery comes from REST protected-resource metadata published by Gateway, so the CLI's configuration has one public endpoint rather than independently configurable Gateway and Web origins. Configuration never contains API Keys, access tokens, or refresh tokens.

### Consequences

- Good, because a human can log in through the existing Web identity experience without copying a long-lived Personal API Key.
- Good, because Personal API Keys remain available and unambiguous for CI, scripts, and headless workflows.
- Good, because an OAuth token's REST audience is distinct from MCP's audience, preserving the boundary ADR-0002 introduced.
- Good, because the fixed client has stable consent, audit, and revocation identity instead of creating one dynamic client row per CLI installation.
- Bad, because Web, Gateway, the CLI, generated REST security documentation, and deployment seeding all change together.
- Bad, because browser login does not serve SSH or other genuinely headless environments in this release; those callers use a Personal API Key.
- Bad, because the user must reauthenticate after the refresh token expires or is revoked.

### Confirmation

Review confirms that only `taskome-cli` can receive the REST OAuth audience; that `/v1` accepts that token while rejecting an MCP OAuth token; and that a Personal API Key remains accepted. Tests exercise the CLI command boundary, Web OAuth routes, and Gateway REST API boundary without asserting Better Auth or keychain internals. The published REST protected-resource metadata names the authorization server that issued the REST token.

## Pros and Cons of the Options

### Personal API Key only

- Good, because Gateway already accepts it and unattended use remains simple.
- Bad, because it makes a long-lived secret the normal human-login experience.
- Bad, because issuing, copying, and revoking keys becomes a prerequisite for every interactive CLI user.

### Dynamically registered OAuth client per installation

- Good, because it needs no server-seeded client row.
- Bad, because consent and audit records identify an opaque installation rather than Taskome's official CLI.
- Bad, because it expands dynamic registration beyond the third-party MCP use case that needs it.

### Fixed public OAuth client with PKCE and Personal API Key fallback

- Good, because it identifies the official CLI without pretending a public native client can hold a secret.
- Good, because PKCE protects the authorization-code exchange and the loopback callback supports a normal browser hand-off.
- Neutral, because public client IDs are not secrets; they are for registration and audit, not client authentication.
- Bad, because the client row must be seeded for every deployed environment.

### Device Authorization Grant in the first release

- Good, because it supports headless and limited-input environments.
- Bad, because the repository's pinned Better Auth version does not provide it; the later provider support requires an upgrade and a second interactive flow.
- Bad, because polling, user-code expiry, and phishing-resistant presentation widen this initial security-sensitive feature.

## More Information

This ADR supersedes ADR-0002 rather than deleting it. Its `Principal` normalization and audience-isolation principles remain in force; only its CLI credential conclusion changes. Reconsider Device Authorization Grant when SSH, remote-container, or other no-browser CLI use becomes a demonstrated product need. Reconsider endpoint profiles only when Taskome actually offers more than one user-facing deployment.
