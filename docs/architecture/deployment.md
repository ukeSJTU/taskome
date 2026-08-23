# Deployment

This page explains how Taskome's accepted containers map onto real machines across development, staging, and production, and which deployment choices remain open. It does not repeat [`containers.md`](./containers.md)'s responsibilities or [`runtime.md`](./runtime.md)'s execution flow — it covers what those pages don't: where each container actually runs, how local development avoids needing real compute infrastructure, and the specific choices deployment still has to make.

> **Target architecture with partial development support.** The repository now
> runs PostgreSQL, Temporal's development server, and a SeaweedFS development
> object store through `compose.yml`. It also contains a buildable fpocket image
> skeleton, but that image has no Attempt entrypoint or deployment integration.
> The Execution Service, Kubernetes integration, runnable Tool Runtime
> entrypoints, and production infrastructure remain unimplemented. This page
> describes the accepted deployment design those components must follow — see
> [`overview.md`](./overview.md) and [`containers.md`](./containers.md) for the
> container-level decisions this page assumes.

## Match deployment shape to how Taskome is actually run

Taskome's environments are not elastic cloud infrastructure. [`constraints.md`](./constraints.md) already establishes that a small product engineering team without dedicated platform or SRE staff operates Taskome — every deployment choice on this page has to stay operable by that team, not by an operations function that doesn't exist.

Three environment shapes follow from that constraint:

| Environment           | GPU access | Machine count                                                                                                       | What this implies                                                                                                                                                                                                                                                                                       |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local development** | None       | One developer workstation                                                                                           | No real Kubernetes cluster and no real GPU are required to develop or test Taskome end to end.                                                                                                                                                                                                          |
| **Staging**           | Yes        | One machine with multiple GPUs                                                                                      | The smallest environment where real compute actually runs. Single-machine operation must be a first-class supported shape, not a degraded one.                                                                                                                                                          |
| **Production**        | Yes        | A small, fixed number of machines: one or more GPU machines plus a machine for the Control Plane Server and Web App | Still a small, largely static fleet, not an autoscaled cloud pool. Kubernetes's own resource-aware scheduling and queuing (see [`runtime.md`](./runtime.md)) is what lets multiple users share this fixed pool — deployment does not need to add node-level autoscaling to satisfy launch requirements. |

This shape is why [`overview.md`](./overview.md) and [`containers.md`](./containers.md) name Kubernetes rather than a cloud-managed batch service as the execution infrastructure: a managed batch service's value is provisioning and tearing down cloud VMs on demand, which doesn't fit a small number of machines Taskome already runs continuously. [`constraints.md`](./constraints.md) still leaves the specific cloud, on-premises environment, and Kubernetes distribution open — see [Choose a Kubernetes distribution later](#choose-a-kubernetes-distribution-later) below.

## Map containers to deployment units

| Container                         | Deployment unit                                                                 | Needs GPU access                                              | Needs a database credential                               |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| Web App                           | Stateless HTTP service, any environment                                         | No                                                            | No (calls the Control Plane Server)                       |
| CLI                               | Distributed binary, runs on a user's machine                                    | No                                                            | No                                                        |
| Control Plane Server              | Long-running HTTP service, at least one replica                                 | No                                                            | Yes — broad domain-authority role                         |
| Execution Service                 | Long-running Temporal Worker process, independent from the Control Plane Server | No — it schedules work, it doesn't run it                     | Yes — narrow, least-privilege domain-transition role only |
| Application Database (PostgreSQL) | Managed or self-hosted database                                                 | No                                                            | —                                                         |
| Object Storage                    | SeaweedFS locally; managed or self-hosted object store outside development      | No                                                            | No                                                        |
| Temporal Service                  | Managed (Temporal Cloud) or self-hosted service                                 | No                                                            | No — owns only its own persistence                        |
| Kubernetes Cluster                | The execution infrastructure itself                                             | The cluster's GPU-capable nodes do; its control plane doesn't | No                                                        |
| Tool Runtime                      | One Kubernetes Job's Pod per Attempt, using an immutable image                  | Only for GPU Tools                                            | No — reads and writes only Object Storage                 |

The Control Plane Server and the Execution Service are separate deployment units even when they share a repository and a build. [`containers.md`](./containers.md) gives them different database roles for a reason: the Execution Service's narrow, least-privilege role only ever transitions Attempt state, records usage, and finalizes outputs, and collapsing it into the Control Plane Server's broader role would erase that boundary. Whether they ship as one release artifact with two entrypoints or as fully separate builds is still open — see [Decide how the Control Plane Server and Execution Service release](#decide-how-the-control-plane-server-and-execution-service-release) below.

## Use SeaweedFS for local object storage

Local development runs the pinned SeaweedFS `4.42` image in single-process
`weed mini` mode. The service creates one `taskome-dev` bucket, persists bytes
in a Compose named volume, and uses fixed credentials that are valid only for
local development. Normal `mise run dev:down` leaves the volume intact;
`mise run dev:clean` explicitly removes it with the other local service data.

The container listens on all interfaces inside the Compose network. The host
publishes only the S3 endpoint at `127.0.0.1:8333` and the development Admin UI
at `127.0.0.1:23646`. Development CORS allows every origin so browser ports can
change without editing infrastructure configuration. The service runs as the
image's `seaweed` user with a read-only root filesystem, no Linux capabilities,
and `/data` as its only persistent writable path.

SeaweedFS is a development dependency, not the selected production Object
Storage product. Taskome depends on a small S3-compatible contract: core object
operations, presigned GET and PUT, and multipart upload. Application code must
not use SeaweedFS management APIs or directory semantics.

When file features are implemented, the TypeScript Control Plane Server and
Execution Service use `@aws-sdk/client-s3` and
`@aws-sdk/s3-request-presigner`. Browser code uses native `fetch` with URLs
issued by the Server. Python `runtime_toolkit` uses Boto3's synchronous S3
client and managed `upload_file`, `download_file`, and `TransferConfig`
transfers. Boto3 already provides threaded multipart concurrency; Taskome does
not add `aioboto3` without a measured need for event-loop concurrency. These
libraries are selected but are not installed in the current scaffolds.

## Run compute without Kubernetes in local development

A developer's workstation has no GPU and no reason to run a real Kubernetes cluster just to exercise Taskome's compute path. The `submitOrReconnectJob`, `observeJob`, and `requestStop` Activities described in [`runtime.md`](./runtime.md) are the only place the Execution Service talks to Kubernetes — in local development, that Activity implementation is swapped for one that runs a Tool Runtime image directly with a local container runtime instead of calling the Kubernetes API.

This is a deployment-time implementation swap, not a general-purpose scheduler abstraction. [`runtime.md`](./runtime.md) already rejects building an adapter layer between Taskome and Kubernetes for production use, on the grounds that no second execution infrastructure is anticipated there. Local development is a different case: it needs _something_ to run the same immutable Tool Runtime image without real cluster infrastructure, and registering a different Activity implementation for a non-production Worker is normal Temporal practice, not a production abstraction.

The Tool Runtime image itself cooperates: every Tool Runtime supports a mock invocation mode that skips downloading real inputs and running the actual Upstream Software, and instead returns deterministic fixture output. Combining the local Activity implementation with mock mode lets a developer exercise the full submit → observe → publish path — including cancellation and failure handling — without a GPU, without real scientific compute, and without a Kubernetes cluster. See [`components/tool-runtime.md`](./components/tool-runtime.md) for how a Tool Runtime image implements this mode.

Host development does not provide a second supported real-compute path through
Pixi. Developers run adapter tests on the host and run real Upstream Software
through the same Runtime image used by staging and production. Direct `pixi
run` use remains a diagnostic technique, not a deployment contract.

## Understand what a Kubernetes control-plane outage does and doesn't affect

[`runtime.md`](./runtime.md) already distinguishes a transient Kubernetes API failure from a confirmed-lost Job or node. The deployment consequence of that distinction is worth stating plainly: an already-scheduled Pod keeps running on its node even while the cluster's control plane is temporarily unreachable, because the component that keeps a Pod running lives on the node, not in the control plane. A control-plane outage blocks new Job submissions and status observation until it recovers — it does not, by itself, kill Attempts that are already executing.

This matters for how much control-plane availability a given environment actually needs. A single-machine staging environment can run without any control-plane high availability at all: if that machine's control plane restarts, in-flight Attempts on it are unaffected, and only new submissions wait until it's back. A production fleet has the same option — accept that a control-plane restart pauses new submissions rather than paying for the dedicated control-plane machines most Kubernetes distributions require for high availability. Whether production makes that trade-off, or dedicates machines to a highly available control plane instead, is a deployment decision, not one this page makes — see [Decide the production control-plane topology](#decide-the-production-control-plane-topology) below.

## Resolve implementation decisions in the owning section

The launch deployment design intentionally leaves these choices open until real usage data or a concrete deployment target resolves them. When one is resolved, update this section and the paragraph above that raised it instead of leaving both in a stale, contradictory state.

### Choose a Kubernetes distribution later

Which Kubernetes distribution runs the execution infrastructure — a lightweight distribution built for small deployments, self-managed nodes on a standard distribution, or a managed Kubernetes offering — is not decided. GPU integration steps and high-availability trade-offs differ across these options and should be evaluated against real deployment targets before this is settled.

### Decide the production control-plane topology

Whether production accepts a single, non-highly-available control plane per environment, or dedicates machines to a highly available one, is open. This decision only needs to be made for production — staging's single-machine shape makes the answer moot there.

### Decide how the Control Plane Server and Execution Service release

Whether the Control Plane Server and Execution Service ship as one release artifact with two entrypoints (coupling their release cadence) or as fully independent builds (more build configuration, fully independent deploys) is open.

### Other open choices already tracked elsewhere

- Temporal Cloud or a self-hosted Temporal Service — [`containers.md`](./containers.md).
- The production Object Storage product and provider — [`containers.md`](./containers.md), [`data.md`](./data.md).
- GPU driver and container-runtime provisioning on cluster nodes, plus Tool
  Runtime signing, scanning, retention, and admission verification —
  [`containers.md`](./containers.md),
  [`components/tool-runtime.md`](./components/tool-runtime.md).
- Production public ingress and TLS termination — [`containers.md`](./containers.md), [`security.md`](./security.md).
- Backup products, schedules, and numeric recovery objectives — [`data.md`](./data.md).
- Observability backend integration and operational runbooks — reserved for their own pages once the deployable units above are settled.

## Related docs

- [`overview.md`](./overview.md) — the architecture strategy this page's deployment shape supports.
- [`containers.md`](./containers.md) — container responsibilities, data ownership, and the choices this page treats as already accepted.
- [`runtime.md`](./runtime.md) — the Activities this page's local-development swap and Kubernetes control-plane discussion assume.
- [`components/tool-runtime.md`](./components/tool-runtime.md) — how a Tool Runtime image implements mock mode.
- [`constraints.md`](./constraints.md) — the operating-team, platform, and licensing constraints this page's environment shapes come from.
- [`security.md`](./security.md) — credential and network-exposure rules that apply across every environment.
