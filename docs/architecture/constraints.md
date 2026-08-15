# Constraints

The technical and organizational limits this architecture deliberately operates inside of — not the product's policy decisions. For those (curated parameters, no job chaining yet, inference-only, flat accounts, no billing), see [`docs/product/vision.md`](../product/vision.md); this page only covers constraints that shape _how_ the system is built, not _what_ it does.

## Technical constraints

- **Single-machine deployment.** Everything runs on one Docker Compose host today. Multi-node GPU scheduling is deferred until single-machine scheduling genuinely stops being enough — see [`docs/architecture/deployment.md`](./deployment.md) and vision.md's Future direction. This isn't a temporary oversight; it's a deliberate incremental-delivery call.
- **Task Servers run one process, one replica.** In-process state (Job dedup, concurrency limits, the output non-overwrite check) makes this load-bearing, not a soft recommendation — see [`docs/architecture/deployment.md`](./deployment.md#known-scaling-limit-task-servers-are-single-process-single-replica) for why.

## Organizational constraints

- **Small team.** The team building and operating Taskome is small, and the tool catalog is expected to keep growing opportunistically (vision.md's Tool scope). This is why [`overview.md`](./overview.md) ranks maintainability and extensibility as the top quality attribute — a small team pays for architectural complexity more directly than a larger one would.
- **Licensing is a release gate, not a development blocker.** Per root `AGENTS.md`'s Licensing principle: using the best-fit third-party tool or license during development is fine; production use, external access, redistribution, or commercial release requires Legal and Compliance approval first. Every vendored or wrapped compute tool (the vendored `fpocket` C tool is the current example) carries this obligation.

## Related docs

- [`docs/product/vision.md`](../product/vision.md) — the product-policy decisions this page deliberately doesn't repeat.
- [`docs/architecture/deployment.md`](./deployment.md) — the full detail behind the Task Server scaling constraint.
- [`docs/architecture/risks.md`](./risks.md) — where these constraints turn into open risk, rather than a settled trade-off.
- Root `AGENTS.md` — the Licensing engineering principle in full.
