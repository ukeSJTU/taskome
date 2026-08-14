# Vision

Taskome is XDenovo's product for running binder and de novo protein design compute — one platform, reachable from a browser, from an AI agent, or from a script, instead of a pile of one-off tool installs.

XDenovo builds AI-native biotech tools (AI4Bio). Taskome is one of its products, not the company itself. XDenovo's public website (also served from this repository, from `apps/web`'s `(public)` route group) speaks at the company level; this document speaks at the product level. If you're looking for how XDenovo presents itself externally, this isn't that page.

## The problem

Binder and de novo protein design tools are GPU-heavy and configuration-heavy. Run them without a shared platform, and every team re-solves the same problems on its own: setting up GPU environments per tool, deciding which of a tool's dozens of parameters actually matter, and wiring up separate access paths for a scientist clicking through a UI versus an AI agent driving the same tool programmatically. Taskome exists so no team has to solve that more than once.

## What Taskome is

A curated set of compute tools, each exposed through the same three-part shape:

- A **Task** — one tool's curated, runnable surface. Its parameters are a deliberately chosen subset of the underlying tool's real configuration, not a full passthrough — chosen per tool, including changes to vendored tool code where that's what it takes to expose the right knobs.
- A **Job** — one invocation of a Task, with its own inputs, status, and outputs.
- Every Task is reachable the same way regardless of how you connect — see [Access, below](#access).

## Who it's for

XDenovo's own design teams, plus a small number of known external collaborators — not the general public. Today that means flat, individual accounts: everyone who has access is someone XDenovo knows directly, so a service hiccup or a visible job list has limited blast radius. This is a starting point, not a permanent ceiling — see [Future](#future-where-this-is-headed).

## Prior art

Taskome's shape borrows from two existing products, each for a different reason:

| Reference                                    | What we share with it                                                                                                                           | What we specifically borrow                                                                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tamarind.bio](https://app.tamarind.bio/app) | Centralizes GPU-backed bioinformatics tools behind one platform; users submit a compute task and get results back through a single entry point. | The idea of one platform fronting many tools, reachable from a web UI. We also like its visual tone and draw loose design inspiration from it.                                      |
| [subseq.bio](https://subseq.bio/)            | Same core pattern: a platform for submitting bioinformatics compute tasks.                                                                      | Its power-user posture — expose a tool's real configuration surface instead of hiding it behind a no-code abstraction. Taskome's curated-parameters policy follows this philosophy. |

## Now: what the first release needs to be true

This is the v1 bar: what has to work for XDenovo's teams and their known collaborators to run on Taskome day to day. It doesn't need to be a polished, fully-scaled platform yet — see [Future](#future-where-this-is-headed) for what comes after.

### Access

Four ways to reach a Task, all built for v1:

- **Web App** — a browser UI, talking to the platform through a backend-for-frontend.
- **MCP Agent** — an AI agent connecting directly over MCP.
- **Direct API Client** — a script or service calling the REST API directly.
- **CLI** — a command-line entry point. This is new for v1: earlier design excluded a CLI in favor of REST/MCP only; that exclusion no longer holds.

### Tool scope

- Inference only. Training-style tools are out of scope for now — see [Future](#future-where-this-is-headed).
- The tool catalog grows opportunistically, with no fixed boundary on what gets added next. The current and planned roster lives in [`docs/product/roadmap.md`](./roadmap.md), not here — this document describes the policy, not the list, so it doesn't go stale every time a tool ships.
- Batch submission is in scope: submitting several independent Jobs in one go. This is not pipeline orchestration (see Future) — each Job in a batch still runs and completes independently.

### Execution

- GPU/CPU scheduling runs on Ray, wired in and working at a basic, usable level — not infrastructure that exists on paper but has no real consumer.
- The design goal is that every Job's output is traceable back to the exact tool version and parameters that produced it. Today's implementation doesn't fully cover tool-version tracking yet, but v1 is built toward closing that gap, not around leaving it open indefinitely.

### Accounts and cost

- No payment or billing. Usage is still metered and recorded, so there's a factual basis for billing later — metering is not the same commitment as charging.
- Accounts stay flat and individual. Whether to add tags or an internal/external distinction is an implementation-time call, not a decision this document makes.

## Future: where this is headed

Direction we're confident in, without a settled design yet. Nothing here blocks v1, and nothing here is promised on a timeline.

- **Pipeline orchestration** — chaining one Job's output into the next Job's input. Explicitly out of scope until it's actually designed.
- **Training tools** — beyond the inference-only tools Taskome starts with.
- **Payment and credits** — a real billing system, once usage metering has given us something to bill against.
- **Collaboration and sharing** — teams sharing a pipeline configuration or a run's results with each other.
- **Deeper scheduling** — smarter Ray allocation strategies, queue fairness, more integrations, and eventually multi-machine deployment, once single-machine scheduling stops being enough.
- **Full multi-tenancy** — organizations, teams, and roles, if and when flat individual accounts genuinely stop being sufficient.

## Related docs

- [`docs/product/roadmap.md`](./roadmap.md) — the concrete tool roster and milestones behind this direction.
- [`docs/product/requirements.md`](./requirements.md) — specific rules and acceptance bar.
- [`docs/architecture/overview.md`](../architecture/overview.md) — how this vision is built.
