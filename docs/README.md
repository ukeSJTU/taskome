# Documentation

Taskome's documentation, organized by what question you're trying to answer.

## Product — what Taskome is and why

- [`product/vision.md`](./product/vision.md) — what Taskome is, who it's for, and the Now/Future scope boundary. Start here.
- [`product/roadmap.md`](./product/roadmap.md) — the tool roster and milestone sequencing.
- [`product/requirements.md`](./product/requirements.md) — specific, checkable rules and the acceptance bar.

## Architecture — how it's built

- [`architecture/overview.md`](./architecture/overview.md) — core principles, quality attributes, and solution strategy. Read this before the diagrams below.
- [`architecture/context.md`](./architecture/context.md) — C4 Context: the system boundary.
- [`architecture/containers.md`](./architecture/containers.md) — C4 Container: what's inside, and how it talks to itself.
- [`architecture/components/`](./architecture/components/) — C4 Component level. Deliberately empty for now; this restructuring stopped at Context + Container (see `architecture/risks.md`).
- [`architecture/data.md`](./architecture/data.md), [`architecture/integrations.md`](./architecture/integrations.md), [`architecture/security.md`](./architecture/security.md), [`architecture/deployment.md`](./architecture/deployment.md), [`architecture/runtime.md`](./architecture/runtime.md) — deep dives, each linked from `overview.md`'s Solution strategy.
- [`architecture/constraints.md`](./architecture/constraints.md) — the technical and organizational limits this architecture operates inside of.
- [`architecture/risks.md`](./architecture/risks.md) — known thin spots and deliberate technical debt.
- [`architecture/runbooks.md`](./architecture/runbooks.md) — on-call and incident handling. Not yet written; no on-call practice exists yet to document.

## Decision records — why, not what

- [`adr/`](./adr/) — architecture decisions that were genuinely contentious, in [MADR](https://adr.github.io/madr/) format. Start at [`adr/README.md`](./adr/README.md) for the index and numbering convention. Don't restate `architecture/` content here — an ADR only exists where a real alternative was considered and rejected.

## Engineering — how to work in this repo day to day

- [`engineering/local-development.md`](./engineering/local-development.md) — setup and the day-to-day command reference.
- [`engineering/testing.md`](./engineering/testing.md) — test seams, directory conventions, and what CI runs.
- [`engineering/coding-standards.md`](./engineering/coding-standards.md) — naming, module boundaries, API and schema conventions.
- [`engineering/ci-cd.md`](./engineering/ci-cd.md) — what CI runs and doesn't run.
- [`engineering/observability.md`](./engineering/observability.md) — tracing/logging requirements and how to view them locally and in production.

## Agent skills and research

- [`agents/`](./agents/) — AI-skill runbooks (issue tracker conventions, triage labels, domain-modeling practice). Not part of this restructuring's scope.
- [`research/`](./research/) — point-in-time audit notes and technical research. Written before this restructuring; not yet folded into the pages above (see `architecture/risks.md`'s scope limitation).

## Everything else

- Root [`CONTEXT.md`](../CONTEXT.md) — the project's domain glossary (Task, Job, Task Server, Gateway, Principal, and so on).
- Root [`AGENTS.md`](../AGENTS.md) — the entry point AI agents load every session; points here for anything beyond a one-line summary.

## Maintaining these docs

- `docs/architecture/` describes what the system is and does — target design, with `> Status note (delete once built):` callouts where today's code hasn't caught up yet. Delete a status note the moment the gap it names closes; don't let it become permanent commentary.
- `docs/adr/` records why — only for decisions where a real alternative existed. If there's only one reasonable option, or the reasoning is already fully captured in an `architecture/` page, it's documentation, not a decision record.
- When a decision changes, update the `architecture/` page it affects and, if it's genuinely a reconsidered ADR, add a new one that supersedes the old rather than editing history away.
