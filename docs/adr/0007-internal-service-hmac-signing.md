---
status: accepted
date: 2026-08-15
decision-makers: Taskome maintainers
---

# HMAC-signed internal requests, not mTLS, for service-to-service calls

## Context and Problem Statement

Taskome's own services call each other for narrow, internal, non-user-facing purposes: Gateway verifies a Personal API Key by calling back into Web, and Gateway and a Task Server call each other for dispatch and Input File resolution. These calls run over plain HTTP within the Docker Compose network (`GATEWAY_INTERNAL_URL`/`WEB_INTERNAL_URL` resolve to `http://gateway:8000`/`http://web:3000`, not HTTPS). How should each service prove to the other that a request is legitimate?

## Decision Drivers

- These are service-to-service calls, not user identity assertions — reusing the external JWT/`Principal` model (ADR-0009) would conflate two different concepts: "which user is asking" versus "is this really Gateway/Web/a Task Server calling."
- Today's requirements and incremental delivery: avoid standing up PKI/certificate-lifecycle infrastructure for a single-machine, small-team v1 deployment.
- Each internal relationship (Web↔Gateway, a given Task Server↔Gateway) should be independently revocable — a leaked secret in one pair shouldn't compromise another.
- A captured request must not be replayable later — proof of possession of a shared secret alone isn't enough.

## Considered Options

- Mutual TLS (mTLS) between services
- Reuse the external JWT/JWKS verification model (ADR-0009) for internal calls too
- HMAC-signed requests, with a per-relationship shared secret and a timestamp

## Decision Outcome

Chosen option: "HMAC-signed requests, with a per-relationship shared secret and a timestamp", because it gives per-relationship blast-radius containment and replay protection without the certificate-lifecycle infrastructure mTLS would require for a single-machine v1 deployment.

Each internal relationship gets its own secret, never reused across relationships: `WEB_GATEWAY_HMAC_SECRET` for Gateway↔Web, and a distinct `GATEWAY_TASK_HMAC_SECRET` per Task Server for Gateway↔Task Server calls. Every signed request carries a timestamp; the receiving side rejects anything older than a fixed max age (300 seconds for the Web↔Gateway path) using a constant-time comparison, closing the replay window a bare shared secret alone would leave open.

This decision does **not** claim confidentiality for these calls. HMAC signing authenticates the sender and detects tampering — it doesn't encrypt the payload. These calls travel in cleartext over the Docker Compose network today, so this security model rests on an assumption that the compose network itself is a sufficiently trusted boundary (not reachable from outside the host, only from containers already on it). That assumption is a real, disclosed constraint, not a settled guarantee — see `risks.md`.

### Consequences

- Good, because it requires no PKI or certificate rotation — a meaningful operational simplification for a single-machine v1.
- Good, because a leaked secret only compromises one relationship, not every internal call in the system.
- Good, because the timestamp plus constant-time comparison closes the replay gap a bare shared secret would leave.
- Bad, because these calls have no transport-layer confidentiality — a compromised container on the same compose network could read the plaintext payload of a legitimate signed request, even though it couldn't forge a new one. See `risks.md`.
- Bad, because secret management is manual today (plain environment variables, no rotation automation) — a general secrets-management gap that HMAC doesn't solve any better than mTLS would have.

### Confirmation

Every internal-only endpoint (Web's Personal API Key verification route, a Task Server's manifest/execution routes) should reject an unsigned or incorrectly signed request outright, and reject a signed request older than its configured max age. Code review should flag any internal secret reused across more than one relationship — `packages/task-kit`'s guidance to never reuse a Task Server's HMAC secret across servers is the existing convention to point to.

## Pros and Cons of the Options

### Mutual TLS

- Good, because it provides both authentication and transport-layer confidentiality in one mechanism.
- Good, because it's a well-understood, standard security model.
- Bad, because it requires a certificate-issuance and rotation story — even a self-signed internal CA needs lifecycle management that Docker Compose doesn't provide out of the box, and that a small team operating a single machine doesn't yet need to take on.

### Reuse the external JWT/JWKS model

- Good, because it would mean maintaining only one verification pattern instead of two.
- Bad, because it conflates "which user is asking" with "which internal service is calling," which are different questions — an internal call isn't acting on behalf of any particular user.
- Bad, because JWKS-based verification assumes a running key-serving endpoint and network round-trips (with caching) that are more machinery than a narrow, high-frequency internal call needs.

### HMAC-signed requests with a per-relationship secret (chosen)

- Good, because it's simple to implement and requires no additional infrastructure.
- Good, because per-relationship secrets contain a leak's blast radius.
- Bad, because it provides no confidentiality on its own — see the disclosed risk above.

## More Information

See [`docs/architecture/security.md`](../architecture/security.md) for how this fits alongside the external Access Channels, and [`docs/architecture/risks.md`](../architecture/risks.md) for the plaintext-internal-network risk this decision accepts. Revisit if Taskome's deployment ever spans more than one machine (`vision.md`'s Future) — internal traffic crossing a real network boundary, rather than staying inside one host's Docker network, would remove the "trusted compose network" assumption this decision rests on and make the case for mTLS much stronger.
