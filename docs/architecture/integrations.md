# Integrations

How Taskome talks to systems outside its own containers, and what happens when those calls fail.

## Task Server dispatch is synchronous — there's no completion webhook

When Gateway dispatches a Job to a Task Server (see [`containers.md`](./containers.md)), it's a direct, blocking REST or MCP call. The Task Server runs the Task's `ComputeAdapter`, publishes its outputs, and returns the result inline in that same call's response. There's no separate callback afterward, no completion webhook, no status-polling endpoint to check later — the dispatch call itself is the completion signal. If you're picturing an async job queue where a worker calls home when it's done, that's not this: the "queue" (see the Job execution section of `containers.md`) is entirely about getting a Job _to_ a Task Server durably and fairly; once it's there, the call is a normal synchronous request.

This is a deliberate, accepted trade-off, not an oversight: if Gateway's own worker process dies while it's waiting on that call — a crash, a restart, a redeploy — the result is lost even if the Task Server finished successfully, because the only channel carrying the result back is that one connection. taskiq's durability guarantee covers getting a Job _to_ a Task Server, not getting the result _back_. There's no automatic recovery from this today; a caller has to resubmit. This is accepted for v1 given the small, trusted user base and `overview.md`'s deliberately low availability priority — it's the kind of thing that would need revisiting (likely by routing the Task Server → Gateway leg through a queue too, not just Gateway → Task Server) if the user base outgrows that assumption.

## Output publication doesn't retry

Publishing a Task's output to SeaweedFS is a deliberately non-retrying operation. SeaweedFS doesn't enforce S3's conditional-PUT semantics, so retrying an upload whose result is ambiguous (did it actually land, or did the request just time out?) risks a duplicate or an overwrite — worse than failing outright. Instead, the publisher does a preflight existence check and refuses to overwrite, rather than retrying blindly. The same applies to a Task Server's calls back to Gateway to resolve an Input File: a failed call propagates as an error immediately, with no built-in backoff or retry.

> **Status note (delete once built):** Because Gateway has no dispatch code yet (see `containers.md`), none of this failure handling has been exercised end-to-end in production — it's only covered by `packages/task-kit`'s own tests today.

## External systems

| System    | What Taskome sends or receives                                               | Failure handling                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Axiom     | Traces and logs over OpenTelemetry, production only                          | Export failures don't block a request — observability is best-effort. See [`docs/engineering/observability.md`](../engineering/observability.md). |
| SeaweedFS | Input Files and Job outputs, via presigned URLs and direct S3-protocol calls | No retry on ambiguous writes (above). See [`data.md`](./data.md).                                                                                 |
| Ray       | GPU/CPU resource requests for Job execution                                  | Undesigned — no code calls Ray yet. See `containers.md`.                                                                                          |

## What's not integrated

No outbound email (no SMTP/email-provider configuration anywhere in the codebase). No inbound webhooks from third parties. No other outbound API integrations exist today beyond the three systems above.

## Related docs

- [`containers.md`](./containers.md) — where dispatch and the Job queue sit.
- [`data.md`](./data.md) — Input File storage and retention.
- [`docs/engineering/observability.md`](../engineering/observability.md) — what gets sent to Axiom.
- `docs/adr/` — the job-dispatch decision behind this, once renumbered.
