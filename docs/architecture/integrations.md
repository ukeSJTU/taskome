# Integrations

How Taskome talks to systems outside its own containers, and what happens when those calls fail.

## Task Server dispatch is synchronous — there's no completion webhook

When Gateway dispatches a Job to a Task Server (see [`containers.md`](./containers.md)), it's a direct, blocking REST or MCP call. The Task Server runs the Task's `ComputeAdapter`, publishes its outputs, and returns the result inline in that same call's response. There's no separate callback afterward, no completion webhook, no status-polling endpoint to check later — the dispatch call itself is the completion signal. If you're picturing an async job queue where a worker calls home when it's done, that's not this: the "queue" (see the Job execution section of `containers.md`) is entirely about getting a Job _to_ a Task Server durably and fairly; once it's there, the call is a normal synchronous request.

This is a deliberate, accepted trade-off, not an oversight: if Gateway's own worker process dies while it's waiting on that call — a crash, a restart, a redeploy — the result is lost even if the Task Server finished successfully, because the only channel carrying the result back is that one connection. taskiq's durability guarantee covers getting a Job _to_ a Task Server, not getting the result _back_. There's no automatic recovery from this today; a caller has to resubmit. This is accepted for v1 given the small, trusted user base and `overview.md`'s deliberately low availability priority — it's the kind of thing that would need revisiting (likely by routing the Task Server → Gateway leg through a queue too, not just Gateway → Task Server) if the user base outgrows that assumption.

### Why a dispatch failure usually can't just be retried

`packages/task-kit`'s `TaskServerRuntime` deduplicates by `job_id` in memory (`claim_job`/`completed_jobs`) — but it does **not** cache a completed job's result. A second call to `POST /internal/tasks/{name}` for a `job_id` that's still running, or that already finished, gets the same `409 duplicate_job` either way, with no way to tell which happened or recover the original outcome if it succeeded. That's why [ADR-0008](../adr/0008-taskiq-ray-async-job-dispatch.md) only retries a dispatch failure when the request is known not to have reached the Task Server at all (connection refused, DNS failure) — anything where the request may have arrived is a terminal failure, not a retry, because retrying it risks reading a real success back as an unrecoverable duplicate rejection. Widening this safely needs `task-kit` itself to start caching and replaying results, which is tracked as future work, not designed yet (see ADR-0008's More Information).

## Output publication doesn't retry

Publishing a Task's output to SeaweedFS is a deliberately non-retrying operation. SeaweedFS doesn't enforce S3's conditional-PUT semantics, so retrying an upload whose result is ambiguous (did it actually land, or did the request just time out?) risks a duplicate or an overwrite — worse than failing outright. Instead, the publisher does a preflight existence check and refuses to overwrite, rather than retrying blindly. The same applies to a Task Server's calls back to Gateway to resolve an Input File: a failed call propagates as an error immediately, with no built-in backoff or retry.

## External systems

| System    | What Taskome sends or receives                                                        | Failure handling                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Axiom     | Traces and logs over OpenTelemetry, production only                                   | Export failures don't block a request — observability is best-effort. See [`docs/engineering/observability.md`](../engineering/observability.md). |
| SeaweedFS | Input Files and Job outputs, via presigned URLs and direct S3-protocol calls          | No retry on ambiguous writes (above). See [`data.md`](./data.md).                                                                                 |
| Ray       | CPU/GPU admission-control reservations, one per Job dispatch (not process management) | Target design in [ADR-0008](../adr/0008-taskiq-ray-async-job-dispatch.md) — no code calls Ray yet. See `containers.md`.                           |

## Outbound email (planned)

Taskome will add transactional email in a later implementation phase. The intended environment split is:

| Environment       | Service                                 | Role                                                                                                       |
| ----------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Local development | [Mailpit](https://mailpit.axllent.org/) | A local SMTP capture inbox for manually inspecting messages. It must not deliver email to real recipients. |
| Production        | [Resend](https://resend.com/)           | The transactional email provider for real delivery.                                                        |

This is a recorded direction, not an implemented integration: there is no Mailpit Compose service, SMTP or Resend configuration, environment variables, email-sending module, or authentication-email callback yet. When the work is taken on, keep provider-specific code behind an application-owned sending boundary so Better Auth's verification and password-reset flows do not depend directly on either Mailpit or Resend. Define the authentication flows, templates, localization, rate limits, delivery-failure handling, and test seams as part of that implementation rather than treating the local inbox as the feature itself.

## What's not integrated

No outbound email is implemented yet (no SMTP/email-provider configuration anywhere in the codebase). No inbound webhooks from third parties. No other outbound API integrations exist today beyond the three systems above.

## Related docs

- [`containers.md`](./containers.md) — where dispatch and the Job queue sit.
- [`data.md`](./data.md) — Input File storage and retention.
- [`docs/engineering/observability.md`](../engineering/observability.md) — what gets sent to Axiom.
- [`docs/adr/0004-gateway-owned-job-dispatch.md`](../adr/0004-gateway-owned-job-dispatch.md) — the job-dispatch decision behind this.
- [`docs/adr/0008-taskiq-ray-async-job-dispatch.md`](../adr/0008-taskiq-ray-async-job-dispatch.md) — why dispatch retries are scoped so narrowly, and the Ray admission-control design.
