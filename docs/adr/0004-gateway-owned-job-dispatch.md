---
status: accepted
date: 2026-08-15
decision-makers: Taskome maintainers
---

# Gateway durably queues Jobs, brokers Ray resources, then dispatches synchronously to the Task Server

## Context and Problem Statement

Submitting a Job needs to be durable (not lost if a process restarts), deduplicated (not run twice), and fair across many submitters — then it needs to actually become a GPU/CPU-scheduled compute call against the right Task Server. Ray is a distributed compute execution engine: it schedules resource-aware work and retries a failed execution, but it doesn't provide durable intake queueing, deduplication, or fairness across submitters on its own — those are a different problem than resource scheduling. Given a durable queue (taskiq, backed by Redis) has to sit in front of Ray to solve intake, who should consume that queue, decide when to ask Ray for resources, and hand the Job to the right Task Server?

## Decision Drivers

- Ray is a compute execution engine, not a job queue — durability, deduplication, and fairness need a different mechanism in front of it.
- Fairness across submitters needs visibility across all Task Servers at once, not a per-Task-Server view.
- The `ComputeAdapter`/`TaskServerRuntime` port split (ADR-0003) already keeps resource-scheduling concerns out of a Task Server's own scope — a Task author shouldn't have to think about cluster-wide fairness.
- `vision.md`'s Future direction explicitly names "queue fairness" and "multi-machine deployment" as later work — the v1 answer doesn't have to solve those yet, only not foreclose them.
- Incremental delivery: avoid standing up an entirely new service before Gateway's dispatch code exists in any form.

## Considered Options

- Gateway consumes the queue, brokers Ray resources, and dispatches to the Task Server itself
- Each Task Server consumes its own slice of the queue and brokers Ray resources independently
- An independent scheduler service, separate from both Gateway and Task Servers, consumes the queue and brokers Ray resources

## Decision Outcome

Chosen option: "Gateway consumes the queue, brokers Ray resources, and dispatches to the Task Server itself", because it keeps fairness and resource-allocation decisions in one place with full visibility, without standing up a new service before Gateway has any dispatch code at all.

Submitting a Job returns as soon as it's durably enqueued (a `202 Accepted` and a Job ID), not once it's finished — GPU compute can take a long time, so the caller polls for the result rather than holding a connection open. Gateway's own worker then consumes the queue, asks Ray for resources, and makes a direct, blocking REST or MCP call to the Task Server. That call's response — the Task's result, returned inline — is the completion signal; there is no separate completion webhook. Gateway does both API-serving and queue-consuming in one deployable for now, not two.

### Consequences

- Good, because fairness and resource-allocation policy live in one place with visibility across every Task Server, not fragmented per Task Server.
- Good, because Task Servers stay simple and passive — they never need Ray access or scheduling logic of their own.
- Good, because this matches the staged evolution `vision.md` already anticipates: centralized in Gateway now, splitting into an independent scheduler later if single-machine, single-service scheduling stops being enough.
- Bad, because Gateway now carries a wide set of responsibilities at once — identity resolution, REST/MCP aggregation, Job queueing, dispatch, and Ray brokering — which is a real coupling risk; see `risks.md`.
- Bad, because the Gateway → Task Server leg has no queue behind it: if Gateway's own worker process dies while waiting on that call, a successfully completed Job's result is lost and the caller must resubmit. Accepted for v1 given the small, trusted user base and this architecture's deliberately low availability priority (`overview.md`) — not an oversight, but a real accepted risk; see `risks.md` and `docs/architecture/integrations.md`.

### Confirmation

Gateway should never expose a code path where a Task Server calls back into Gateway to report Job completion — the absence of any such endpoint is itself the check. `docs/architecture/containers.md`'s Job execution section and `docs/architecture/runtime.md`'s sequence diagram are the reference shape to diff any real implementation against.

## Pros and Cons of the Options

### Gateway consumes the queue and dispatches itself (chosen)

- Good, because it centralizes fairness and resource-brokering decisions where they can see the whole system.
- Good, because it extends work Gateway already owns (aggregating and dispatching to Task Servers) rather than inventing a new responsibility holder.
- Neutral, because it makes Gateway responsible for more than identity and aggregation, at least until a future split.

### Each Task Server consumes its own queue slice

- Bad, because a Task Server that can only see its own queue can't implement fairness across the whole system — a submitter's fair share has to account for every Task Server, not one.
- Bad, because it pushes resource-scheduling concerns into every Task Server, directly working against the `ComputeAdapter`/`TaskServerRuntime` split's goal of keeping Task authors focused on compute logic alone.
- Bad, because it doesn't shrink in cost as the tool catalog grows opportunistically — every new Task Server would need its own scheduling logic.

### Independent scheduler service

A dedicated service, separate from Gateway and every Task Server, consumes the queue and brokers Ray resources.

- Good, because it's the cleanest separation of concerns — identity/aggregation, scheduling, and compute all live in distinct services that can scale independently.
- Good, because it's the natural next step once single-machine, single-service scheduling stops being enough (`vision.md`'s Future: deeper scheduling, multi-machine deployment).
- Bad, because it's a new service to design, deploy, and operate before Gateway even has a first working dispatch path — more complexity than today's requirements justify.

## More Information

See [`docs/architecture/containers.md`](../architecture/containers.md) for the diagram this decision produces, [`docs/architecture/runtime.md`](../architecture/runtime.md) for the sequence diagrams, and [`docs/architecture/integrations.md`](../architecture/integrations.md) for the full reasoning behind the no-completion-webhook trade-off. Revisit this decision when Gateway's combined responsibilities become a demonstrated operational problem, or when vision.md's Future scheduling work is actually picked up.
