---
status: accepted
---

# Gateway owns synchronous Job dispatch and aggregates Tasks from signed manifests

Every valid Task invocation becomes a Gateway-owned Job before compute begins, regardless of whether the caller used REST or MCP. Gateway must therefore be a Job-aware MCP provider rather than ADR-0007's transparent FastMCP proxy. This ADR supersedes ADR-0007 and defers ADR-0005's Taskiq/callback design: the first implementation is synchronous end to end, while durable async dispatch, timeout, retries, and worker scheduling will be designed together with Taskiq and Ray.

## Task identity and discovery

A Task Server may expose multiple Tasks. A local Task name is unique only within its server; Gateway configuration assigns each server a unique lowercase name and one internal URL. Gateway stores `(server_name, local_task_name)` as separate fields and generates the external name with FastMCP's native single-underscore namespace convention, for example `fpocket_detect`. It never parses the qualified string to recover identity. Startup fails on any generated-name collision.

`build_task_server` compiles its immutable TaskDefinition registry into signed `GET /internal/manifest`:

```json
{
    "schema_version": 1,
    "server_name": "fpocket",
    "tasks": [
        {
            "name": "detect",
            "description": "Detect binding pockets in a protein structure.",
            "params_schema": {},
            "result_schema": {}
        }
    ]
}
```

The schemas describe the semantic `ParamsT -> ResultT` contract, not Task Server or public Job transport envelopes. They are generated once from the same definitions that register local REST and MCP behavior, cached, strict about extra properties, and returned in definition order. `schema_version=1` versions only this manifest wire shape. There is deliberately no Task version, build revision, manifest hash, ETag, dynamic self-registration, heartbeat, or background refresh.

Gateway has a static server-name-to-URL configuration. During startup it fetches and authenticates every manifest, verifies the expected server name, builds the qualified Task catalog, and creates its REST/MCP projections. If any configured server is unavailable or invalid, Gateway refuses readiness. Once running, it retains that startup catalog if a Task Server later becomes unavailable; calls to that server fail, but no catalog mutation occurs until Gateway restarts.

## Job creation and synchronous dispatch

For either external channel, Gateway performs this sequence:

1. Authenticate the caller and normalize a Principal.
2. Resolve the qualified Task in the startup manifest catalog.
3. Validate JSON-Schema-expressible arguments before creating durable state, including ownership and current existence checks for referenced Input Files.
4. Create one Job in `queued` with the resolved server/local Task identity, one Params object, owner, and trace id.
5. Mark that Job `running` and make one signed call to the target Task Server over the same interface the caller selected: local MCP for an MCP call, or `POST /internal/tasks/{local_task_name}` for REST.
6. Persist `ok` plus the returned value/output metadata, or `error` plus a stable safe code, from that completion.
7. Project raw storage keys to short-lived Gateway-generated download URLs in caller-visible Job responses.

Gateway owns all Job state transitions. A synchronous Task Server does not create Job identity and does not call a completion webhook. Pydantic validators that JSON Schema cannot express may still reject the request at the Task Server after Job creation; such a Job ends in `error` with `invalid_input`. Requests that fail authentication, Task resolution, or Gateway's schema validation create no Job.

One Job always represents one Task call with one Params object, not a batch of independent inputs. A Params object can reference several Input Files when they jointly form one computation; independently applying a Task to two structures creates two Jobs. One successful Job can persist zero or many named output objects alongside its small Result value.

The Task Server's internal success response contains only `value` and Published Output metadata with raw storage keys. It never echoes Principal, owner, credentials, Job state, server identity, or Job id. Gateway is the only component that stores the completed Job and generates external URLs.

## Bidirectional signed HTTP

Gateway and each Task Server share a distinct secret of at least 32 bytes; no Task Server secret is reused by another server or by Web/Gateway authentication. The same HTTP-header protocol authenticates internal REST, manifest, and FastMCP HTTP requests. FastMCP initialize and discovery remain unsigned because they carry no Job execution, while `tools/call` is signed.

Headers are `X-Taskome-Timestamp`, `X-Taskome-Signature`, optional `X-Taskome-Job-Id`, and optional standard `traceparent`. The hexadecimal HMAC-SHA256 signature uses constant-time comparison over:

```text
taskome-v1
{unix_timestamp}
{UPPER_METHOD}
{raw_path_and_query}
{job_id_or_empty}
{traceparent_or_empty}
{sha256_hex(raw_body)}
```

Execution requires a Job id; manifest uses the empty value. Including Job id and trace context prevents an otherwise valid signed body from being rebound to different context headers. A request outside the default 300-second clock window is rejected. v1 does not add a key id or overlapping-secret rotation protocol; rotation is a coordinated restart.

The verifier reads at most the configured body limit, hashes the exact bytes received, and replays those bytes to FastAPI/FastMCP through pure ASGI middleware. REST bodies are limited to 4 MiB and MCP messages to 1 MiB. Oversized bodies fail with 413 before parsing. Signatures, secrets, Params, presigned query strings, raw tool stderr, and user sequences are not logged.

## Input File materialization

Immediately before compute, the Task Server makes one signed batch request:

```http
POST /internal/jobs/{job_id}/input-files/resolve
```

with the de-duplicated Input File ids discovered from that Job's Params. Gateway verifies that the signing Task Server is the Job's assigned server and that every requested id appears in the frozen Params. It returns each id, a fresh short-lived presigned GET URL, and the exact declared `size_bytes`. Supporting this contract requires Gateway to persist the declared size when it creates an Input File; original filenames remain display-only and are not returned as local paths.

Task Server downloads the files immediately, using controlled UUID filenames and exact-size verification. It has no standing read credential for Gateway's `uploads/` prefix. Input File deletion or missing bytes after Job creation is a visible `input_materialization_failed` Job error rather than silent substitution.

## Synchronous delivery limits

Gateway makes no automatic retry after an ambiguous Task Server request. A caller retry creates a new Job. Task Server rejects a repeated id in the same process, output writes are conditional and deterministic at `{server_name}/{job_id}/{output_name}`, and every normal path cleans its workdir. These measures reduce accidental replay but do not promise exactly-once execution or recovery across restart.

The synchronous version requires one process and one replica per Task Server, one Gateway URL per configured server, and stop-then-start deployment rather than rolling overlap. Task Server calls may run for hours and have no outer total timeout. Forced termination can leave a running/ambiguous Job or an orphan object; rollback is best effort and background orphan collection is deferred.

When Taskiq/Ray is designed, Gateway will enqueue by stable Job id and workers will use a durable atomic Job claim. That replaces the synchronous HTTP wait, process-local queue and duplicate LRU, and single-replica restriction; Taskiq acknowledgement or retry alone is not treated as exactly-once execution. Callback/reconciliation, deadline, cancellation, retry, cross-restart recovery, and capacity semantics are deliberately absent until that design.
