---
status: accepted
date: 2026-08-17
decision-makers: Taskome maintainers
---

# Two-phase taskiq dispatch, Ray admission control, and async MCP job tools

## Context and Problem Statement

[ADR-0004](./0004-gateway-owned-job-dispatch.md) decided _who_ consumes the Job queue and brokers Ray resources — Gateway itself, in one deployable — but left the concrete mechanics undecided: which taskiq broker, when a message gets acknowledged, how retries interact with a Task Server that can't safely replay a duplicate call, what "ask Ray for resources" actually means when Task Servers are already-running standalone processes rather than Ray-managed workloads, and how to detect a stuck Job when execution time legitimately varies by orders of magnitude with input parameters.

Today's code has also drifted from ADR-0004's shape in one specific way: REST already returns `202 Accepted` + a Job ID and expects the caller to poll `GET /v1/jobs/{id}` — but MCP still dispatches through `submit_job_and_wait`, a single tool call that blocks until the Job reaches a terminal state. That's two different Job lifecycles behind one Gateway, not one shared lifecycle across every access channel. Redis is connected but only used for a startup health check; nothing calls Ray; there is no taskiq dependency at all. This ADR is the concrete design that closes that gap.

## Decision Drivers

- Every access channel (REST, Web, CLI, MCP) should share one Job lifecycle — submit, get a Job ID, poll or wait — not have MCP be a synchronous outlier.
- `task-kit`'s Task Server dedup (`claim_job`/`completed_jobs` in `packages/task-kit`'s `TaskServerRuntime`) is in-memory, keyed only by `job_id`, and does **not** cache the result of a completed job — a duplicate call to `POST /internal/tasks/{name}` for an already-finished job gets an opaque `409 duplicate_job`, not the original outcome. Any retry or redelivery mechanism built on top of this must not assume a repeated call is safely observable.
- Ray's native resource-declaration idiom (`@ray.remote(num_cpus=…, num_gpus=…)`, overridable per call via `.options(...)`) is inherently per-invocation, so it composes with a per-Task declared value without inventing new Ray machinery.
- A Task's execution time can vary by an order of magnitude or more with its input parameters alone (generating 10,000 sequences vs. 1,000) — any staleness or timeout signal must not depend on predicting a "typical" duration.
- ADR-0004 already accepts "Gateway's worker dies mid-dispatch, the result is lost, the caller resubmits" as a v1 risk. New mechanics should stay inside that accepted boundary rather than building distributed-lease recovery to work around it.
- `AGENTS.md`'s engineering principles: least complex solution for today's requirements, no speculative abstraction.

## Considered Options

Several independent sub-decisions make up this design; each is treated as its own set of options below rather than one monolithic choice, because each has a distinct trade-off:

1. **taskiq broker**: `taskiq-redis`'s `PubSubBroker` / `ListQueueBroker` (no ack) vs. `RedisStreamBroker` (ack + consumer groups).
2. **Message acknowledgment timing**: ack only after the Job reaches a terminal state ("late ack", enabling broker-level crash redelivery) vs. ack immediately once the Job is claimed ("early ack").
3. **Retry mechanism for a failed Task Server call**: a single taskiq task retried in place by `SmartRetryMiddleware` vs. a two-phase `claim` → `execute_dispatch` task chain where only the execute phase retries.
4. **Scope of "retryable" failure**: retry any dispatch failure vs. retry only failures where the request is known not to have reached the Task Server.
5. **Ray's role**: pure admission-control resource reservation vs. Ray actively managing Task Server process lifecycle/replicas.
6. **Staleness detection**: one fixed global timeout vs. two orthogonal signals — a duration-independent heartbeat, and a per-Task worst-case execution ceiling.
7. **MCP tool shape**: keep one blocking tool per Task vs. split into a non-blocking per-Task submit tool plus generic `get_job`/`wait_job` tools.

## Decision Outcome

**Process topology.** Gateway gains a second process, the **Gateway Worker** — same codebase and image as Gateway's API process (still one deployable, per ADR-0004), run as a distinct entrypoint/Compose service. Single replica for v1; the worker itself holds no state that would prevent scaling later (all state lives in Postgres and Redis), but Task Servers' own single-replica constraint (`constraints.md`) makes matching that simplicity now, and revisiting scale-out later, the lower-cost choice.

**Broker: `RedisStreamBroker`.** `taskiq-redis`'s `PubSubBroker` and `ListQueueBroker` don't support acknowledgment at all — a worker killed mid-message loses that message outright, which fails the durability promise `vision.md` makes for the queue. `RedisStreamBroker` supports ack and consumer groups and is the only one of the three actually durable.

**Two-phase task chain, not a single retried task.** A Job's dispatch is split into two taskiq tasks:

- **`claim_job`** consumes the original `job_id` message. It does one thing — a row-locked `queued → running` transition (`JobRepository.mark_running`). If the Job is no longer `queued` (already claimed by an earlier delivery), it no-ops. On success, it enqueues `execute_dispatch(job_id)` and _then_ acknowledges its own message.
- **`execute_dispatch`** does the actual work: request Ray resources, call `TaskDispatcher`, write the terminal Postgres state. It's decorated `retry_on_error=True, max_retries=3`, using `SmartRetryMiddleware` for exponential backoff with jitter (capped around 30s between attempts).

Both tasks **ack immediately** on start ("early ack"), not after completion. This is deliberate, not a simplification left for later: `task-kit`'s Task Server dedup returns `409 duplicate_job` for a repeated `job_id` and does not cache or replay a completed job's result, so a broker-redelivered duplicate call after a real crash could read back as "already claimed, no result available" even when the original call actually succeeded — turning a legitimate success into a false failure. Early ack keeps taskiq's durability contribution scoped to what it can actually guarantee safely: a Job is never lost while merely _waiting_ to be claimed (worker briefly down during a deploy, etc.). Recovery from a crash _during_ dispatch is explicitly out of scope for automatic retry — see the staleness section below — matching the risk ADR-0004 already accepted.

The claim/execute split exists specifically so this stays consistent: `SmartRetryMiddleware` re-invokes a task's entire function body on failure. If claim and dispatch lived in one task, a legitimate retry of a transient dispatch failure would re-run the claim step too, find the Job already `running` from the first attempt, and silently no-op instead of retrying — the exact bug this design avoids by never letting `execute_dispatch`'s retries touch claim logic at all.

**Retryable failure scope is narrow.** `TaskDispatcher` distinguishes two exception classes. Only failures where the request is known not to have reached the Task Server — connection refused, DNS failure, anything before the request left Gateway — are retryable. Anything where the request may have arrived (a timeout awaiting the response, a connection reset mid-transfer) is treated as terminal: `mark_failed`, no retry. This is forced by the same `409`-with-no-cached-result behavior above — retrying an ambiguous failure risks hitting a duplicate-claim rejection for a job that actually already succeeded, with no way to recover the real result. Widening this safely would require `task-kit` to cache and replay a completed job's result on a duplicate call; that's real future work (see More Information) but is a change to the shared Task Server framework, out of scope here.

**Ray: admission control only.** Task Servers remain independently-running, standalone processes — Ray doesn't spawn or manage them. A generic placeholder `@ray.remote` function is called with `.options(num_cpus=…, num_gpus=…)` set from a new `resources` field on the Task's manifest (alongside the existing params JSON Schema, fetched from the Task Server the same way), held for exactly the duration of the synchronous `TaskDispatcher` call, and released after. Ray's job here is purely to make the cluster's physical CPU/GPU capacity a real admission-control constraint across every Task Server at once — nothing more.

**Staleness detection: two orthogonal signals, not one timeout.** A single fixed "running too long" threshold can't work once Task execution time genuinely varies by an order of magnitude with input size — the reason today's flat 150-second `RUNNING_TIMEOUT_SECONDS` needs replacing, not just retuning:

- **Heartbeat** (detects a dead worker, independent of task duration): while `execute_dispatch` is blocked on `TaskDispatcher`, a concurrent loop updates the Job's `last_heartbeat_at` every 20 seconds, cancelled once the call returns. A `running` Job whose heartbeat is more than 60 seconds stale is treated as orphaned. This is checked lazily, the same way the existing 150s reconciliation works today — on next read (`GET /v1/jobs/{id}` etc.), not via a background sweep — and marks the Job `failed`. It never predicts duration; it only asks "is the process that owns this Job still reporting in."
- **Execution ceiling** (detects a hung-but-alive Task Server): each Task declares `max_duration_seconds` on its manifest — a conservative worst-case bound ("this should never legitimately take longer than X regardless of input"), not an expected duration. This value becomes the literal client-side HTTP timeout on the dispatch call. Tripping it is a terminal, non-retried failure (`execution_timed_out`) — retrying an already-maxed-out call would very likely just time out again.

Both are read-time / call-time checks, not a background scanning process — consistent with `overview.md`'s quality-attribute ordering, where availability is deliberately the lowest priority and this is a best-effort signal for the caller to know when to resubmit, not a guaranteed-fast recovery mechanism.

**MCP tool contract now matches REST/Web/CLI.** Each Task keeps its own generated `submit_<task>` tool, but it stops blocking — it returns `job_id` and `status: "queued"` immediately, the same shape REST's `202 Accepted` gives today. Gateway's MCP surface gains two generic tools, `get_job(job_id)` and `wait_job(job_id, timeout)`. `wait_job` polls Postgres server-side (default timeout 60s, configurable up to ~300s) and, critically, **never errors on timeout** — it returns the Job's current status, so a caller (often an agent loop that doesn't want to hand-write a polling loop) gets a result either way and decides whether to call `wait_job` again. This replaces `submit_job_and_wait` outright — no compatibility shim, per `AGENTS.md`'s cleanup principle; nothing depends on the old blocking contract in production today.

**Explicitly not addressed by this design** (recorded so they aren't silently assumed): idempotent/deduplicated submission (a client-side retry of `POST /v1/jobs` producing two Jobs) is unaddressed; fairness across submitters stays a single global FIFO stream, no priority lanes — `vision.md` already places both "queue fairness" and deeper scheduling policy in Future scope, so neither needed a v1 answer here. No new observability/metrics were designed for the queue, worker, or Ray path — existing OpenTelemetry instrumentation carries over as-is, with specific metrics added if and when an operational need shows up.

### Consequences

- Good, because every access channel now shares one Job lifecycle — submit, get an ID, poll or wait — closing the gap between REST's existing async shape and MCP's previously-blocking one.
- Good, because a Job is never silently lost while merely queued (unlike today's `asyncio.create_task` fire-and-forget, which loses everything on a Gateway restart) — the specific window taskiq's durability actually protects is real and meaningfully better than the status quo.
- Good, because staleness detection no longer requires guessing a task's duration — a heartbeat and a worst-case ceiling are each simple, robust signals answering a narrower question than "how long should this take."
- Bad, because dispatch failures where the outcome is genuinely unknown (timeout awaiting a response) are never retried, even though some of them probably would have succeeded on retry — this is a direct, accepted consequence of `task-kit`'s dedup not caching results; narrowing it further needs that framework-level change (see More Information).
- Bad, because a worker crash _during_ dispatch still has no automatic recovery — the caller must notice (via staleness detection surfaced on next read) and resubmit. This is the same risk ADR-0004 already accepted, not a new one, but it's worth restating that this design doesn't close it.
- Neutral, because Ray's role here is narrow (admission control only) — it doesn't yet deliver the "deeper scheduling" `vision.md` names as Future work, and isn't meant to.

### Confirmation

Diff any real implementation against `docs/architecture/containers.md`'s Job execution section and `docs/architecture/runtime.md`'s Job dispatch sequence diagram — both updated alongside this ADR to show the two-phase chain, the Gateway Worker as its own container, and the heartbeat/ceiling staleness checks. `execute_dispatch` should never be observed re-running `claim_job`'s logic (the claim/execute split is exactly what prevents this) — a regression here would show up as a Job repeatedly bouncing between `queued` and `running` without ever reaching a terminal state.

## Pros and Cons of the Options

### Broker: `RedisStreamBroker` (chosen) vs. `PubSubBroker`/`ListQueueBroker`

- Good, because it's the only one of the three that supports acknowledgment and consumer groups — the others lose an in-flight message outright if the consuming worker is killed.
- Neutral, because Redis Streams' delivery is at-least-once, not exactly-once — but this design already treats every task as needing to tolerate re-invocation (claim as a no-op-safe gate, execute as retry-safe by scope), so this doesn't add a new requirement.

### Ack timing: early (chosen) vs. late

- Good (early), because it avoids relying on `task-kit`'s dedup semantics to make a broker-redelivered duplicate call safe — which today's `409`-with-no-result-caching contract can't actually guarantee.
- Bad (early), because it gives up "free" crash recovery via broker redelivery — a worker SIGKILLed mid-dispatch doesn't get automatically retried by the broker the way it would with late ack.
- Good (late, rejected), because it would provide crash recovery without any new Gateway-side machinery.
- Bad (late, rejected), because task-kit's Task Server would reject the redelivered retry with `409 duplicate_job` whether the original call is still running _or_ already succeeded, and a duplicate call after real success has no way to recover the actual result — worse than not retrying at all in the success case.

### Retry mechanism: two-phase task chain (chosen) vs. single task with `SmartRetryMiddleware`

- Good (two-phase), because retries never re-execute claim logic, so a legitimate retry can't be silently swallowed by the idempotency gate.
- Neutral, because it's two registered taskiq tasks instead of one — marginally more code, but each has a single, narrow responsibility.
- Bad (single task, rejected), because `SmartRetryMiddleware` re-invokes the entire task body — retrying a dispatch failure would re-attempt the claim, find the Job already `running`, and no-op instead of actually retrying the dispatch.

### Retryable scope: narrow / pre-send-only (chosen) vs. retry any dispatch failure

- Good (narrow), because it's the only scope that's actually safe given `task-kit`'s dedup returns an unrecoverable `409` for any duplicate call to an already-processed job.
- Bad (narrow), because failures that would have succeeded on retry (an ambiguous timeout where the Task Server actually finished) are never retried — a real cost, traded for correctness under today's Task Server contract.

### Ray: admission control only (chosen) vs. Ray-managed Task Server lifecycle

- Good (admission control), because it matches `vision.md`'s v1 bar ("wired in and working at a basic, usable level") without redesigning how Task Servers run.
- Good (admission control), because it doesn't touch `constraints.md`'s existing single-replica-per-Task-Server deployment contract.
- Bad (admission control), because it doesn't get any closer to `vision.md`'s Future "deeper scheduling" — that's left fully undesigned, deliberately.

### Staleness: heartbeat + execution ceiling (chosen) vs. one fixed timeout

- Good (chosen), because neither signal requires predicting a Task's duration from its parameters — the heartbeat answers "is the worker alive," the ceiling answers "is this Task Server hung," and both questions are independent of how long a legitimate execution should take.
- Bad (chosen), because it's two mechanisms and two new pieces of state (`last_heartbeat_at`, per-Task `max_duration_seconds`) instead of one number.
- Bad (fixed timeout, rejected), because a single global value either falsely fails long-but-legitimate executions or fails to catch a genuinely stuck short task — vision.md's own roadmap (`task-boltz`, `task-openmm`) makes this concretely worse over time, not just theoretically.

### MCP tools: submit + generic get/wait (chosen) vs. keep one blocking tool per Task

- Good (chosen), because it matches REST's already-async shape, closing the inconsistency that motivated this ADR.
- Good (chosen), because `wait_job` still gives MCP callers a single-call, result-in-hand experience when they want one, without forcing every caller into a hand-written poll loop.
- Bad (chosen), because it's a breaking change to the current MCP tool contract — accepted because nothing in production depends on the old blocking shape today.

## More Information

**Deferred, tracked as future work, not designed here:** upgrading `packages/task-kit`'s `TaskServerRuntime.completed_jobs` from an LRU set of bare `job_id`s to a small result cache (status, result/error, completion time) keyed by `job_id`, with `POST /internal/tasks/{name}` returning the cached outcome on a duplicate call instead of `409 duplicate_job`. This would let the "retryable failure scope" decision above widen safely (an ambiguous timeout could be retried and either get "still running" or the actual cached result back), and would make late-ack broker-level crash recovery viable. It's a change to the shared Task Server framework contract — affecting every Task Server, not just this Gateway Worker design — so it belongs in its own future ADR when picked up, not folded into this one.

See [`docs/architecture/containers.md`](../architecture/containers.md) for the updated diagram, [`docs/architecture/runtime.md`](../architecture/runtime.md) for the updated sequence, [`docs/architecture/integrations.md`](../architecture/integrations.md) for the full dispatch-failure-handling picture, and [ADR-0004](./0004-gateway-owned-job-dispatch.md) for the ownership decision this elaborates on without changing.
