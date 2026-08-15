---
status: accepted
date: 2026-08-15
decision-makers: Taskome maintainers
---

# Self-hosted SeaweedFS for object storage, with direct client access via presigned URLs

## Context and Problem Statement

Taskome needs to store Input Files and Job outputs — often large binary files — without routing them through Next.js's request path or an MCP agent's context window, and without operating a heavyweight storage cluster for a single-machine, small-team v1. Which storage technology fits, and once chosen, should clients read and write it directly or always through Gateway?

## Decision Drivers

- Large files routed through Gateway's own request path, or an MCP agent's context window, waste bandwidth and risk hitting context-window limits.
- Self-hosted, S3-compatible storage keeps the operational surface consistent with the rest of the single-machine v1 stack (Postgres, Redis, Ray are all self-hosted too).
- Team size and today's requirements: avoid an operationally heavy storage cluster for a small team's v1 needs.
- Output publication needs a "don't silently overwrite an existing output" guarantee, given the v1 constraint of one process and one replica per Task Server (see `constraints.md`).

## Considered Options

- SeaweedFS (self-hosted, S3-compatible)
- MinIO (self-hosted, S3-compatible)
- Garage (self-hosted, S3-compatible, built for lightweight/non-datacenter use)
- A managed cloud object store (for example, AWS S3)

## Decision Outcome

Chosen option: "SeaweedFS", because it's lightweight enough to self-host alongside the rest of the single-machine stack, exposes a standard S3 API that existing `boto3` clients already speak, and keeps file data inside Taskome's own infrastructure rather than a third-party cloud account.

Clients don't route file bytes through Gateway at all: Gateway mints a short-lived (15-minute) presigned URL for an upload or download, and the caller — a browser, a CLI, a script — talks to SeaweedFS directly with it. Gateway only ever handles the URL, never the bytes. Output publication asks for the S3 `If-None-Match: *` conditional-write precondition on the upload, so an existing object at the same key can't be silently overwritten.

This decision does **not** claim the non-overwrite guarantee is solid today. SeaweedFS's support for that specific conditional-write semantic is recent (added sometime between August 2025 and January 2026) and still has open bugs on versioned/locked buckets as of this writing. Because of that, output publication also does a preflight existence check before writing, rather than relying on the conditional-write header alone — and this fallback is what the v1 one-process/one-replica constraint (`constraints.md`) makes safe, not a property of SeaweedFS itself. See `risks.md` for the open risk this leaves.

### Consequences

- Good, because self-hosting keeps file data and ops inside Taskome's own Compose stack — no cloud vendor dependency or recurring bill for v1.
- Good, because a standard S3 API means Gateway and `task-kit` use plain `boto3` clients, not a custom storage integration.
- Good, because direct client access keeps large file transfers off Gateway's own request path entirely, regardless of which backend is behind it.
- Bad, because the non-overwrite guarantee this design leans on is resting on a conditional-write feature that's still evolving industry-wide (even AWS S3 itself only added it in August 2024) — this is an open risk, not a settled property; see `risks.md`.
- Bad, because production wiring for public SeaweedFS reachability isn't complete yet — see the status note in `docs/architecture/containers.md`.

### Confirmation

`packages/task-kit`'s output publisher should never retry an ambiguous write (see `docs/architecture/integrations.md`) — a retry after an unclear failure is exactly the failure mode this design is trying to avoid. Any change to the storage backend should re-verify conditional-write behavior against the exact pinned version in use before relying on it.

## Pros and Cons of the Options

### SeaweedFS (chosen)

- Good, because it's already integrated (`apps/gateway/src/gateway/services/storage.py`) and lightweight to run alongside the rest of the stack.
- Good, because it's simple to operate for a small team.
- Bad, because its S3 conditional-write support is recent and still has open bugs in some configurations (versioned/locked buckets) as of this writing.

### MinIO

- Good, because it has supported conditional writes (`If-Match`/`If-None-Match`) since 2023, longer than SeaweedFS.
- Bad, because it doesn't support the `*` wildcard AWS S3 uses for "create only if this key doesn't exist" — it requires an exact ETag instead, which doesn't fit Taskome's actual need and would still require the same preflight-existence-check workaround. Switching to MinIO would not remove the underlying risk.

### Garage

- Good, because it's designed for exactly this use case: lightweight, self-hosted, non-datacenter object storage.
- Bad, because its conditional-write support is unconfirmed in its own compatibility documentation, and it doesn't support object versioning at all — no clearer a win than SeaweedFS on the specific guarantee this decision needs.

### A managed cloud object store (for example, AWS S3)

- Good, because AWS S3 has full, native conditional-write support with no preflight-check workaround needed.
- Bad, because it moves file data outside Taskome's own infrastructure and introduces a recurring cost and an external dependency, at odds with `vision.md`'s self-hosted, single-machine v1 posture.

## More Information

See [`docs/architecture/data.md`](../architecture/data.md) for retention/deletion behavior and presigned URL TTLs, [`docs/architecture/integrations.md`](../architecture/integrations.md) for the no-retry policy on output publication, and [`docs/architecture/risks.md`](../architecture/risks.md) for the open conditional-write risk. Revisit if Task Servers ever need to run more than one replica — the preflight-existence-check workaround stops being safe the moment two processes can race each other, which would force either a real conditional-write guarantee or moving the non-overwrite guarantee into Postgres instead.
