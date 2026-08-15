# Runtime view

Two flows, end to end: submitting a Job and getting its result, and moving an Input File in or out of storage. Container names here match [`containers.md`](./containers.md) exactly.

## Job dispatch

```mermaid
sequenceDiagram
    actor Caller
    participant Gateway
    participant Postgres
    participant Redis as Redis (taskiq)
    participant Ray
    participant TaskServer as Task Server

    Caller->>Gateway: POST /v1/jobs (Task params)
    Gateway->>Gateway: resolve caller to Principal
    Gateway->>Postgres: create Job row (status=queued)
    Gateway->>Redis: enqueue Job
    Gateway-->>Caller: 202 Accepted, Job ID

    Note over Gateway,Redis: asynchronous — Gateway's own worker consumes the queue

    Gateway->>Redis: consume next Job
    Gateway->>Ray: request GPU/CPU resources
    Ray-->>Gateway: resources granted
    Gateway->>TaskServer: dispatch Job (REST or MCP)
    TaskServer->>TaskServer: run ComputeAdapter
    TaskServer->>TaskServer: publish outputs to SeaweedFS
    TaskServer-->>Gateway: result (inline response)
    Gateway->>Postgres: update Job row (status=completed, result)

    Caller->>Gateway: GET /v1/jobs/{id}
    Gateway-->>Caller: Job status and result
```

Submitting a Job returns immediately once it's durably queued — not once it's finished. GPU compute can take a long time, and vision.md already treats a Job as something with its own ongoing status, not a single request/response round trip. The Caller polls for the result rather than holding a connection open or waiting on a callback; there's no completion webhook. Note that this durability guarantee only covers the Caller → Gateway leg: the Gateway → Task Server dispatch later in this diagram is a plain blocking call with no queue behind it, and a lost connection there loses the result — see [`integrations.md`](./integrations.md) for that accepted trade-off.

> **Status note (delete once built):** This entire flow, from "enqueue" onward, is target design — see `containers.md`'s Job execution section for exactly what exists in code today (short answer: none of the queue-to-dispatch path).

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
- [`docs/adr/0005-seaweedfs-storage-and-presigned-urls.md`](../adr/0005-seaweedfs-storage-and-presigned-urls.md) — the presigned-URL decision behind these flows.
