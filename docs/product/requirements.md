# Requirements

Specific, checkable rules — the acceptance bar a feature is measured against. `vision.md` explains why and what Taskome is; this page doesn't repeat that. If a change conflicts with a rule here, that's a signal to revisit the rule deliberately, not to ship around it silently.

## API contract

- Every Task's MCP and REST surfaces must exist together and behave equivalently. Neither ships as a "REST-only for now, MCP later" partial state.
- Each Task's parameters must be a curated subset of the underlying tool's real configuration — never an undesigned full passthrough of every flag the underlying tool accepts.

## Traceability

- Every Job's output must be traceable back to the exact tool version and parameters that produced it. This is a design goal Taskome is built toward — today's implementation doesn't fully cover tool-version tracking yet (see the status notes in [`docs/architecture/overview.md`](../architecture/overview.md)), but that's a gap to close, not a rule to relax.

## Access

- A Personal API Key must be revocable, and revocation must take effect immediately on the next request — no caching or delay window.

## Batch execution

- Each Job in a batch submission must succeed or fail independently. One Job's failure must never cascade into another Job in the same batch.

## File handling

- Large Input Files and Job outputs must never pass through Gateway's own request path.

## Related docs

- [`docs/product/vision.md`](./vision.md) — why these rules exist.
- [`docs/architecture/overview.md`](../architecture/overview.md) — where today's implementation stands against the traceability goal.
- [`docs/architecture/risks.md`](../architecture/risks.md) — known gaps against these rules that are tracked, not silently accepted.
