---
status: superseded by ADR-0009
date: 2026-08-15
decision-makers: Taskome maintainers
---

# Channel-specific credentials, normalized into one identity model at Gateway

> **Superseded by [ADR-0009](./0009-cli-oauth-login-and-api-key-automation.md).**
> This ADR established the durable principle that Gateway resolves every incoming
> credential to one `Principal`. ADR-0009 keeps that principle but replaces this
> ADR's CLI-specific conclusion: the CLI now defaults to interactive OAuth for
> Gateway's REST resource, while Personal API Keys remain its explicit
> non-interactive automation path.

## Context and Problem Statement

Taskome is reached through four kinds of caller — a Web App user through its BFF, an MCP Agent, a Direct API Client script or service, and a CLI — each with a naturally different credential shape: a browser holds a short-lived session cookie, an MCP Agent holds an OAuth access token, a script or CLI holds a long-lived Personal API Key. How should Gateway authenticate all four without every downstream piece of business logic having to know which channel a request came through?

## Decision Drivers

- "Every Task speaks REST and MCP equally" (`overview.md`'s Core principles) — authorization can't fork into channel-specific logic scattered through business code.
- Security: a credential minted for one surface (say, MCP) must not be replayable against another (REST) if it leaks or is reused.
- Each channel's natural credential shape is genuinely different — a browser can't safely hold a long-lived API key, and a CLI or script shouldn't need a full interactive OAuth flow just to run.
- The CLI was added to scope after the other three channels existed (`vision.md`'s Now) — the model needs to absorb a new channel without a redesign.

## Considered Options

- One shared credential type and verifier for every channel
- Channel-specific credentials, normalized into one internal `Principal` at Gateway's boundary
- No shared identity model — each channel authorizes independently

## Decision Outcome

Chosen option: "Channel-specific credentials, normalized into one internal `Principal` at Gateway's boundary", because it lets each channel use the credential shape that actually fits it while keeping everything downstream of authentication channel-agnostic.

Three credential kinds map to one `Principal`: a session JWT (Web App, via its BFF), an MCP OAuth access token (MCP Agent), and a Personal API Key (Direct API Client and CLI — the CLI is not a distinct credential kind, it's the same REST-plus-Personal-API-Key relationship as any other non-browser caller, just packaged as a terminal tool). Session JWTs and MCP OAuth tokens are both signed by Web and verified by Gateway against Web's JWKS endpoint, but scoped to different audiences (Gateway's REST resource vs. its MCP resource) so a token minted for one surface is rejected on the other. Personal API Keys are verified by Gateway calling back to a narrow, HMAC-signed internal endpoint on Web.

### Consequences

- Good, because nothing downstream of `Principal` resolution has to branch on how the caller connected.
- Good, because audience-scoped tokens prevent a session JWT or MCP token from being replayed against the other surface.
- Good, because the CLI slotted into an existing channel (Direct API Client) instead of requiring a new credential kind or a new verification path.
- Bad, because there are three separate verification code paths to maintain, even though they converge on one `Principal` type.
- Bad, because Personal API Keys never expire by default — a real accepted risk, not an oversight; see `risks.md`.

### Confirmation

Every Gateway request handler receives a resolved `Principal`, never a raw credential — code review should reject any handler that inspects a JWT, OAuth token, or API key directly instead of going through the shared verifier. `apps/gateway/src/gateway/core/auth.py`'s `CredentialKind` enum is the source of truth for which kinds exist.

## Pros and Cons of the Options

### One shared credential type for every channel

Every channel would present the same kind of credential — for example, everyone gets an API key, including the browser.

- Good, because there's only one verification path to build and maintain.
- Bad, because it forces the least-safe option onto every channel — a browser holding a long-lived API key is a materially worse security posture than a short-lived session JWT.
- Bad, because it doesn't fit an MCP Agent's actual OAuth-based connection model without inventing a nonstandard flow.

### Channel-specific credentials, normalized at the boundary (chosen)

- Good, because each channel gets the credential shape that actually fits its trust model.
- Good, because normalizing at one boundary (Gateway) means the rest of the system only ever deals with one identity concept.
- Neutral, because it costs three verification implementations instead of one, though each is narrow.

### No shared identity model

Each channel's authorization stays local to the code path that handles it, with no common `Principal` concept.

- Bad, because every piece of business logic that needs to know "who is this" would have to special-case each channel, defeating "every Task speaks REST and MCP equally."
- Bad, because adding a new channel (as happened with the CLI) would mean auditing every authorization check in the codebase instead of adding one verifier.

## More Information

See [`docs/architecture/security.md`](../architecture/security.md) for the full verification mechanics (JWKS, HMAC signing, audience scoping) and [`docs/architecture/context.md`](../architecture/context.md) for the four channels at the system boundary. Revisit if a channel needs finer-grained scopes than "the Principal's full permissions" — Personal API Keys deliberately deferred scoping until a concrete need exists.
