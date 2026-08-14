---
status: superseded by ADR-0027
---

# Async Job dispatch via Taskiq (RedisStreamBroker), completion via callback + reconciliation sweep

Scope: this covers **async** Task Jobs only. A sync Task's Job still resolves directly within its REST/MCP call — no queue involved (see `CONTEXT.md`'s `Job` definition).

The gateway always creates the Job first (a row in its own `jobs` table, `queued`) — Task Servers never originate Job identity. For async Tasks, dispatch is no longer a direct HTTP push: the gateway enqueues via **Taskiq**, using `taskiq-redis`'s **`RedisStreamBroker` explicitly** — not the default `PubSubBroker`/`ListQueueBroker`, which the library's own docs say lose in-flight messages on worker crash. This makes dispatch durable across Task Server downtime: a Job enqueued while its Task Server is restarting waits safely in the stream instead of being lost. Redis runs with AOF persistence enabled so the stream itself survives a Redis restart too.

Taskiq was chosen over the alternatives considered (arq: now maintenance-only/effectively unmaintained; SAQ: smaller ecosystem, no official FastAPI integration, list-based rather than Streams-based recovery; Celery/Dramatiq: not asyncio-native, heavier than needed) primarily for its actively maintained `taskiq-fastapi` integration package, matching our FastAPI-based Task Server adapter layer.

**Known tradeoff to actively manage, not a blocker**: Redis Streams' consumer-group reclaim (`xautoclaim`) is time-based (`idle_timeout`), not a liveness signal — it does not kill an in-flight job on its original worker, but if set too low it can cause the _same_ job to be claimed and re-executed by a second worker while the first is still legitimately running (jobs here range from minutes to multiple hours, with no fixed upper bound). Mitigations: (1) `idle_timeout` is set comfortably above the longest realistic job duration, accepting slower reclaim of genuinely crashed jobs in exchange; (2) the job handler takes a short-lived Redis lock keyed by `job_id` before actually starting the subprocess, so an accidental redelivery is a no-op rather than a duplicate GPU-consuming execution; (3) the gateway's own reconciliation sweep (below) is the faster, purpose-built mechanism for detecting a genuinely crashed Task Server — the queue's own reclaim timing is a slow backstop, not the primary detector.

When a Task Server finishes running a Job's subprocess, it still pushes the result to the gateway (`POST /internal/jobs/{job_id}/complete` with final status and the SeaWeedFS result key) rather than the gateway polling every in-flight Job. As a safety net against a missed callback, the gateway periodically sweeps Jobs stuck in `running` past a generous threshold and re-queries the owning Task Server directly.

We considered a durable-execution engine (e.g. Temporal) for this, since it would give crash-safe tracking and retries for free. Rejected for now: it requires standing up its own server, database, and worker processes, which is disproportionate to today's needs — there's no multi-step Task chaining yet. Because the gateway's `jobs` table/REST/MCP contract doesn't expose _how_ dispatch and completion are tracked internally, swapping this for a workflow engine later doesn't require changing anything outside the gateway.
