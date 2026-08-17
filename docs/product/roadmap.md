# Roadmap

Milestones from the start of the project to `vision.md`'s Now bar — not a day-to-day task tracker. For the policy behind why tools get added opportunistically instead of against a fixed list, see [`vision.md`](./vision.md)'s Tool scope; this page is the concrete sequencing and roster that policy deliberately keeps out of vision.md.

## Scope of this document

This page sequences _what_ becomes true, in what order, and how far along each step is — not _how_ it gets built. A milestone already decided or under way has its "how" written down in its own ADR(s), linked inline below; a milestone that hasn't started yet gets its "how" written when a spec is produced for it (see the `to-spec` skill). A milestone's checklist items stay at the same altitude as the milestone itself — a verifiable outcome ("Gateway has a real Job/Task data model"), never an implementation step ("wire up the taskiq consumer loop"). Task-level work belongs in GitHub Issues, not here.

## Milestones

Milestones 1-3 are Taskome's shared foundation; they don't depend on each other and are listed in roughly the order they were built. Milestones 4 onward are strictly sequenced: get one tool fully working end to end before adding the next Access Channel, and within that, add whichever channel needs the least additional plumbing first.

1. **Web + Gateway app skeletons, identity, and observability — Done.** `apps/web` (Next.js) and `apps/gateway` (FastAPI) exist as independent deployables, each owning its own Postgres schema — Web holds auth data, Gateway holds everything else.
    - [x] Data ownership split by schema, one Postgres instance shared by both services — [ADR-0001](../adr/0001-schema-per-service-data-ownership.md)
    - [x] Access-channel credentials normalize into one `Principal` at Gateway's boundary; CLI REST OAuth plus the Personal API Key automation path are decided — [ADR-0009](../adr/0009-cli-oauth-login-and-api-key-automation.md)
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
6. **CLI channel — Not started.** Uses interactive OAuth for the REST resource and retains Personal API Keys for automation; Gateway must accept the new REST OAuth credential path — [ADR-0009](../adr/0009-cli-oauth-login-and-api-key-automation.md).
    - [ ] A CLI tool authenticates through OAuth login or an explicit Personal API Key path
    - [ ] The CLI covers Job submission and status lookup

Once milestone 6 lands, `task-fpocket` is reachable from all four Access Channels — the Now bar.

## Tool roster

Unlike the milestones above, this roster has no finish line: `vision.md`'s tool-scope policy grows the catalog opportunistically, with no fixed boundary on what's added next. Appearing here isn't a promise — it's what's shipped or been looked at so far.

Each row is a **Task Server**: its Tasks share a container, dependencies, resource profile, model weights, and deployment lifecycle. The listed license state is an engineering admission decision, not legal advice. Before a Server is exposed beyond internal development, Legal and Compliance must approve the pinned source revision, weights, databases, and final image.

| Task Server                                               | Initial Tasks                                                                                       | Status and admission gate                                                                                                                                                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task-fpocket`                                            | binding-pocket detection                                                                            | **In progress** — see milestone 4 above.                                                                                                                                                                                  |
| `task-sequence-design`                                    | backbone-conditioned sequence design (ProteinMPNN); ligand-conditioned sequence design (LigandMPNN) | **Next candidate (P0).** Upstream code is MIT; pin the selected checkpoints and complete the normal image/dependency review.                                                                                              |
| `task-boltz`                                              | complex-structure prediction; affinity ranking                                                      | **Next candidate (P0).** Upstream code and released weights are MIT; pin the selected release and verify all runtime dependencies.                                                                                        |
| `task-chai`                                               | all-atom complex prediction                                                                         | **Next candidate (P0).** Upstream code is Apache-2.0. Record the applicable weight-release terms alongside the chosen version before promotion.                                                                           |
| `task-openmm`                                             | structure minimization; short, fixed-protocol molecular dynamics                                    | **Next candidate (P0).** OpenMM and its bundled components use more than one permissive/copyleft license; ship a complete notice and dependency inventory.                                                                |
| `task-vina`                                               | ligand docking baseline                                                                             | **Candidate (P1).** AutoDock Vina is Apache-2.0; it is intentionally separate from GPU docking because it has a CPU resource profile.                                                                                     |
| `task-colabfold`                                          | structure prediction; multimer prediction; optional MSA search                                      | **Candidate, terms review required.** ColabFold's code is MIT, but AlphaFold parameters and MSA databases have separate terms and attribution requirements. Do not treat the wrapper license as sufficient.               |
| `task-rfdiffusion`                                        | backbone generation; binder generation                                                              | **Candidate, commercial-use confirmation required.** Source-code terms alone are insufficient: confirm the chosen checkpoint and hosted-service rights with Rosetta Commons before exposing it to external collaborators. |
| `task-rosetta`                                            | relax; interface analysis; peptide-docking refinement                                               | **Hold — commercial license required.** Rosetta/PyRosetta are valuable internal capabilities, but their commercial use needs a separately acquired Rosetta Commons license.                                               |
| `task-foldseek`                                           | structural novelty and similarity check                                                             | **Candidate (P1), GPL-3.0 compliance required.** Keep it process-isolated and review source-offer and image-distribution obligations before release.                                                                      |
| PepMimic, BindCraft, BioMCP, Galaxy/Galaxy MCP, pdb-tools | —                                                                                                   | **Researched, not committed.** Reference material lives under `references/`. Per the opportunistic-expansion policy, appearing here isn't a promise — it's what has been considered so far.                               |

The first implementation batch should be `task-sequence-design`, `task-boltz`, `task-chai`, and `task-openmm`. It closes the current gap between generating a candidate and independently checking its sequence, structure, affinity, and physical plausibility without introducing pipeline orchestration. `task-rfdiffusion`, `task-colabfold`, and `task-rosetta` remain deliberately gated on their respective license records.

Once a tool beyond `task-fpocket` is picked up, adding it mostly means writing its `ComputeAdapter` — `task-kit` already generates REST and MCP together for it (milestone 2), and all four Access Channels already reach Gateway (milestones 1, 5, 6).

## Related docs

- [`docs/product/vision.md`](./vision.md) — the Now/Future policy this roadmap sequences.
- [`docs/architecture/containers.md`](../architecture/containers.md) — the current implementation gaps each in-progress milestone closes.
- [`docs/adr/`](../adr/) — the decisions behind each milestone.
