# Roadmap

Milestones from the start of the project to `vision.md`'s Now bar — not a day-to-day task tracker. For the policy behind why tools get added opportunistically instead of against a fixed list, see [`vision.md`](./vision.md)'s Tool scope; this page is the concrete sequencing and roster that policy deliberately keeps out of vision.md.

## Scope of this document

This page sequences _what_ becomes true, in what order, and how far along each step is — not _how_ it gets built. A milestone already decided or under way has its "how" written down in its own ADR(s), linked inline below; a milestone that hasn't started yet gets its "how" written when a spec is produced for it (see the `to-spec` skill). A milestone's checklist items stay at the same altitude as the milestone itself — a verifiable outcome ("Gateway has a real Job/Task data model"), never an implementation step ("wire up the taskiq consumer loop"). Task-level work belongs in GitHub Issues, not here.

## Milestones

Milestones 1-3 are Taskome's shared foundation; they don't depend on each other and are listed in roughly the order they were built. Milestones 4 onward are strictly sequenced: get one tool fully working end to end before adding the next Access Channel, and within that, add whichever channel needs the least additional plumbing first.

1. **Web + Gateway app skeletons, identity, and observability — Done.** `apps/web` (Next.js) and `apps/gateway` (FastAPI) exist as independent deployables, each owning its own Postgres schema — Web holds auth data, Gateway holds everything else.
    - [x] Data ownership split by schema, one Postgres instance shared by both services — [ADR-0001](../adr/0001-schema-per-service-data-ownership.md)
    - [x] Four Access Channels' distinct credentials (session JWT, MCP OAuth token, Personal API Key) normalize into one `Principal` at Gateway's boundary — [ADR-0002](../adr/0002-identity-and-access-channels.md)
    - [x] Structured observability (OpenTelemetry → Axiom) wired into both services
    - [x] Frontend deployable and shared-package boundaries (`@taskome/config`, `@taskome/ui`) settled — [ADR-0006](../adr/0006-frontend-deployable-and-package-boundaries.md)
    - [x] Internal service-to-service calls (Gateway↔Web, Gateway↔Task Server) are HMAC-signed and independently revocable per relationship — [ADR-0007](../adr/0007-internal-service-hmac-signing.md)
2. **task-kit: the Task Server framework — Done.** Every Task Server is built on one shared package instead of each hand-rolling its own REST/MCP wiring.
    - [x] `build_task_server()` generates a Task Server's REST and MCP surface together from one shared execution core — [ADR-0003](../adr/0003-task-kit-task-server-framework.md)
    - [x] The vendored-code and process-boundary conventions a Task Server follows are settled
3. **File storage: SeaweedFS and presigned URLs — In progress.** Large Input Files and Job outputs never pass through Gateway's own request path.
    - [x] Design decided: Gateway only mints presigned URLs, never proxies file bytes — [ADR-0005](../adr/0005-seaweedfs-storage-and-presigned-urls.md)
    - [x] Direct-access upload/download works in local development
    - [ ] Production wiring complete (`compose.prod.yml` includes SeaweedFS, Caddy routes to it)
4. **`task-fpocket` end to end, via MCP and Direct API Client — In progress.** MCP Agent and Direct API Client ship together here because both reach Gateway directly — no Web BFF work is needed for either.
    - [ ] Gateway has a real Job/Task data model
    - [ ] The dispatch path — a durable queue, then a resource request to Ray — is wired in and working, not infrastructure that exists on paper with no real consumer — [ADR-0004](../adr/0004-gateway-owned-job-dispatch.md)
    - [x] `task-fpocket` actually calls `build_task_server()`
    - [x] Both the MCP and REST surfaces are verified end to end for `task-fpocket`, standalone (not yet reachable through Gateway's dispatch path above)
5. **Web App channel — Not started.** Reuses milestone 4's dispatch path; no new Gateway-side work.
    - [ ] Web's BFF can submit a `task-fpocket` Job through Gateway
    - [ ] Web's BFF can surface a Job's status
6. **CLI channel — Not started.** Reuses the same REST-plus-Personal-API-Key path a Direct API Client already uses; no new Gateway-side work, just a new client.
    - [ ] A CLI tool authenticates through that existing path — [ADR-0002](../adr/0002-identity-and-access-channels.md)
    - [ ] The CLI covers Job submission and status lookup

Once milestone 6 lands, `task-fpocket` is reachable from all four Access Channels — the Now bar.

## Tool roster

Unlike the milestones above, this roster has no finish line: `vision.md`'s tool-scope policy grows the catalog opportunistically, with no fixed boundary on what's added next. Appearing here isn't a promise — it's what's shipped or been looked at so far.

| Tool                                                          | Status                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `task-fpocket` (binding pocket detection, wrapping `fpocket`) | In progress — see milestone 4 above.                                                                                                                                                 |
| PepMimic, BindCraft, BioMCP, Galaxy/Galaxy MCP, pdb-tools     | Researched, not committed. Reference material lives under `references/`. Per the opportunistic-expansion policy, appearing here isn't a promise — it's what's been looked at so far. |

Once a tool beyond `task-fpocket` is picked up, adding it mostly means writing its `ComputeAdapter` — `task-kit` already generates REST and MCP together for it (milestone 2), and all four Access Channels already reach Gateway (milestones 1, 5, 6).

## Related docs

- [`docs/product/vision.md`](./vision.md) — the Now/Future policy this roadmap sequences.
- [`docs/architecture/containers.md`](../architecture/containers.md) — the current implementation gaps each in-progress milestone closes.
- [`docs/adr/`](../adr/) — the decisions behind each milestone.
