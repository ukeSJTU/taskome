# Runtime view

Two flows, end to end: submitting a Job and getting its result, and moving an Input File in or out of storage. Container names here match [`containers.md`](./containers.md) exactly.

## Job dispatch

```mermaid
sequenceDiagram
    actor Caller as Caller (REST / MCP / Web / CLI)
    participant Gateway
    participant Postgres
    participant Redis as Redis (taskiq)
    participant Worker as Gateway Worker
    participant Ray
    participant TaskServer as Task Server

    Caller->>Gateway: submit Job (POST /v1/jobs or MCP submit_<task>)
    Gateway->>Gateway: resolve caller to Principal
    Gateway->>Postgres: create Job row (status=queued)
    Gateway->>Redis: enqueue claim_job(job_id)
    Gateway-->>Caller: Job ID, status=queued

    Note over Redis,Worker: asynchronous from here — Gateway Worker consumes the queue

    Redis->>Worker: deliver claim_job(job_id)
    Worker->>Postgres: claim: queued -> running (row-locked)
    Worker->>Redis: enqueue execute_dispatch(job_id)
    Worker--)Redis: ack claim_job

    Redis->>Worker: deliver execute_dispatch(job_id)
    Worker--)Redis: ack execute_dispatch (early ack)
    Worker->>Ray: reserve resources (.options(num_cpus, num_gpus), per manifest)
    Ray-->>Worker: resources granted
    par heartbeat while blocked
        Worker->>Postgres: touch last_heartbeat_at (every ~20s)
    and dispatch
        Worker->>TaskServer: dispatch Job (REST or MCP), timeout = max_duration_seconds
        TaskServer->>TaskServer: run ComputeAdapter
        TaskServer->>TaskServer: publish outputs to SeaweedFS
        TaskServer-->>Worker: result / error (inline response)
    end
    Worker->>Postgres: mark_completed / mark_failed

    Caller->>Gateway: GET /v1/jobs/{id} (REST/Web/CLI) or MCP get_job / wait_job
    Gateway->>Postgres: read Job (reconcile staleness if running + heartbeat/ceiling exceeded)
    Gateway-->>Caller: status and result
```

Submitting a Job returns immediately once it's durably queued — not once it's finished. GPU compute can take a long time, and vision.md already treats a Job as something with its own ongoing status, not a single request/response round trip. Every access channel shares this same shape: REST gets `202 Accepted` + a Job ID and polls `GET /v1/jobs/{id}`; MCP's `submit_<task>` returns `job_id` the same way, and either polls with `get_job` or blocks server-side (with a timeout that never errors, just returns current status) via `wait_job`. There's no completion webhook in either direction — not Task Server back to Gateway, and not Gateway back to the original caller.

Retries only ever happen inside `execute_dispatch`, and only for a failure known not to have reached the Task Server (connection refused, DNS failure) — see [ADR-0008](../adr/0008-taskiq-ray-async-job-dispatch.md) for why a failure that might have reached the Task Server is treated as terminal instead of retried, and why `claim_job` and `execute_dispatch` are split into two tasks rather than one retried task. If the Worker process dies mid-`execute_dispatch` (after acking, before writing a terminal state), there's no automatic recovery — the heartbeat/ceiling staleness check surfaces this on the caller's next read, and the caller resubmits. This is the same accepted risk [ADR-0004](../adr/0004-gateway-owned-job-dispatch.md) names for the Gateway → Task Server leg, unchanged by this design.

> **Status note (delete once built):** This diagram is target design from ADR-0008. What exists in code today: the Job data model, REST `POST /v1/jobs` (`202` + in-process `asyncio.create_task` dispatch, not a queue) and `GET /v1/jobs/{id}`, and an MCP surface that still dispatches synchronously (`submit_job_and_wait`) rather than the `submit`/`get_job`/`wait_job` split shown here. No taskiq usage, no Gateway Worker process, and nothing calls Ray yet — see `containers.md`'s Job execution section.

## Input File upload and download

```mermaid
sequenceDiagram
    actor Caller
    participant Gateway
    participant Postgres
    participant SeaweedFS

    rect rgb(240, 240, 250)
    Note over Caller,SeaweedFS: Upload
    Caller->>Gateway: POST /v1/input-files (filename)
    Gateway->>Postgres: create input_files row
    Gateway-->>Caller: presigned upload URL (15 min TTL)
    Caller->>SeaweedFS: PUT file bytes (presigned URL)
    SeaweedFS-->>Caller: 200 OK
    end

    rect rgb(240, 250, 240)
    Note over Caller,SeaweedFS: Download
    Caller->>Gateway: GET /v1/input-files/{id}
    Gateway->>Postgres: verify ownership, not deleted
    Gateway-->>Caller: presigned download URL (15 min TTL)
    Caller->>SeaweedFS: GET file bytes (presigned URL)
    SeaweedFS-->>Caller: file bytes
    end
```

Gateway never sees the file's bytes in either direction — it only ever mints a short-lived, ownership-checked URL. This part is implemented today (unlike Job dispatch above); see [`data.md`](./data.md) for the retention rules and exact TTL this diagram references.

## Related docs

- [`containers.md`](./containers.md) — the containers these sequences run across.
- [`data.md`](./data.md) — Input File retention and the presigned URL TTL.
- [`integrations.md`](./integrations.md) — why Job dispatch has no completion webhook.
- [`security.md`](./security.md) — what "resolve caller to Principal" actually checks.
- [`docs/adr/0004-gateway-owned-job-dispatch.md`](../adr/0004-gateway-owned-job-dispatch.md) — the job-dispatch decision behind these flows.
- [`docs/adr/0008-taskiq-ray-async-job-dispatch.md`](../adr/0008-taskiq-ray-async-job-dispatch.md) — the claim/execute task chain, Ray brokering, and MCP tool shape behind the Job dispatch diagram above.
- [`docs/adr/0005-seaweedfs-storage-and-presigned-urls.md`](../adr/0005-seaweedfs-storage-and-presigned-urls.md) — the presigned-URL decision behind these flows.
