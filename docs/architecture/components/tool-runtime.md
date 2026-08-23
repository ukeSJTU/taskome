# Tool Runtime and packages/toolkit

This page goes one level below [`containers.md`](../containers.md)'s Tool Runtime container: how each Tool's runtime is actually structured in the repository, what it shares with every other Tool, and how it cooperates with the Execution Service without ever talking to it directly. It does not restate the surrounding execution flow — see [`runtime.md`](../runtime.md) for how a Kubernetes Job around a Tool Runtime gets submitted, observed, and finalized.

> **Target architecture, not shipped code.** No `apps/tool-*` application or `packages/toolkit` package exists in the repository yet. This page describes the accepted design they must follow once built.

> **Boundary, not internal design.** This page fixes _what_ `packages/toolkit` is responsible for, _what_ stays Tool-specific, and _how_ a Tool Runtime cooperates with the rest of the system — the boundary is the actual decision here. It does not fix `packages/toolkit`'s internal API: module names, file layout, function signatures, and other internal naming are intentionally left open and need their own concrete design pass immediately before implementation, not inferred from this page's illustrative descriptions.

## One immutable application per Tool

Every launch Tool — Pocket Detection, Protein Binder Design, and the rest — is its own application: `apps/tool-fpocket`, `apps/tool-bindcraft`, and so on. Each is a `uv` Python project with its own `Dockerfile`, built into the immutable Runtime artifact that [`containers.md`](../containers.md) says every Attempt's Kubernetes Job runs.

Each Tool application owns only what's specific to that Tool:

- its curated input, parameter, and output contract (the reviewed surface [`requirements.md`](../../product/requirements.md)'s `TOOL-002` requires, not Upstream Software's full configuration);
- its adapter around the actual Upstream Software invocation; and
- its own tests.

Everything else — the plumbing every Tool needs regardless of which Upstream Software it wraps — lives in `packages/toolkit`, a Python library each `apps/tool-*` depends on. The table below names responsibilities, not modules, functions, or files — see [Design packages/toolkit's internal API before implementation](#design-packagestoolkits-internal-api-before-implementation) below:

| `packages/toolkit` responsibility           | Why it's shared, not per-Tool                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Invocation and Result data types            | Every Tool Runtime parses the same shape of input and produces the same shape of manifest.                                   |
| Staged input download and output upload     | Every Tool Runtime reads from and writes to Object Storage the same way.                                                     |
| Checksum and manifest generation            | The manifest format that `validateAndFinalize` (see [`runtime.md`](../runtime.md)) verifies is one format, not one per Tool. |
| Structured logging and error classification | Every Attempt's `failure_kind` needs to come from a shared, consistent classification, not five independent ones.            |
| Mock invocation mode                        | Described below — every Tool needs the same escape hatch for local development.                                              |
| Runtime test utilities                      | Testing the sequence below shouldn't be reinvented per Tool.                                                                 |

A Tool's own parameter models and Upstream Software adapter are deliberately _not_ in `packages/toolkit` — they're the one part of each Tool that has to stay Tool-specific, and folding them into a shared package would recreate the "expose Upstream Software's complete configuration" problem `TOOL-002` exists to prevent.

## The sequence every Tool Runtime follows

A Tool Runtime container has exactly one job: run once, then exit. It is not a server, does not poll for work, and does not outlive its Attempt. Every Tool Runtime performs the same sequence, regardless of which Tool it is:

1. Read the Attempt's invocation — scoped input references, parameters, and its Object Storage staging target — from whatever the Kubernetes Job's Pod spec and environment carry, and nothing more.
2. If invoked in mock mode (see below), skip straight to step 4 with deterministic fixture output instead of running the Tool.
3. Otherwise, download the referenced inputs, then run the Tool's own adapter against them.
4. Build a manifest describing the result, and upload both the manifest and the staged outputs to the Attempt's Object Storage staging namespace.
5. Exit with a status that reflects success or failure.

The container never receives a Temporal, database, or Kubernetes credential of any kind at any step, matching [`security.md`](../security.md)'s least-authority rule for Tool Runtimes: one short-lived Attempt grant, immutable input references, and its ephemeral workspace. This sequence — not any particular module or function name — is what `packages/toolkit` needs to make easy to implement consistently across every Tool.

## Why the manifest travels through Object Storage, not a direct call

`runtime.md`'s `validateAndFinalize` Activity needs the manifest — output names, checksums, sizes, and object references — that a finished Tool Runtime produced. A Tool Runtime can't hand that manifest to the Execution Service directly: it holds no credential that would let it call Temporal, the Kubernetes API, or the Application Database, and it has no network path to the Execution Service to call even if it wanted to.

Object Storage is the one system a Tool Runtime already has scoped write access to, so the manifest travels the same way the outputs it describes do: written as a JSON file into the Attempt's own staging namespace, alongside the staged outputs it describes. Once the Kubernetes Job reaches a terminal state, `validateAndFinalize` reads that file from the same staging namespace, checks it against the objects that actually exist, and only then commits the Job Output rows [`data.md`](../data.md) treats as authoritative. This adds no new communication channel — it reuses the boundary [`containers.md`](../containers.md) already draws around Tool Runtimes.

Because the Execution Service (TypeScript) and `packages/toolkit` (Python) don't share a language, this manifest format is a schema-level contract, not a shared-code one: both sides parse and produce the same JSON shape independently. Where that schema is defined and how each side validates against it is still open — see [Define the manifest schema's source of truth](#define-the-manifest-schemas-source-of-truth) below.

## Run without real compute in local development

Every Tool Runtime image supports the same mock invocation mode: step 2 of the sequence above branches around downloading real inputs and running the Tool's own adapter, and returns deterministic fixture output instead — no network access to Object Storage, no GPU, and no real Upstream Software execution required.

This exists specifically to pair with [`deployment.md`](../deployment.md)'s local-development Activity swap: a developer's machine runs the same immutable image real environments run, with the Execution Service pointed at a local container runtime instead of a real Kubernetes cluster, and the image itself pointed at mock mode instead of real compute. The result is that submission, observation, cancellation, and output publication are all exercisable end to end on a GPU-less workstation, without a second, divergent "dev version" of the Tool Runtime to keep in sync with the real one.

## Trade-offs and design choices

- **One immutable image per Tool, not a shared mutable Runtime serving several Tools.** [`overview.md`](../overview.md) allows one Runtime to support more than one Tool only when they share the same Upstream Software, dependencies, artifact, and deployment lifecycle — which is why `apps/tool-fpocket` and `apps/tool-bindcraft` are separate applications rather than branches inside one. The cost is more Dockerfiles and more images to publish; the benefit is that retiring, patching, or rolling back one Tool's Upstream Software version never risks another's.
- **`packages/toolkit` is Python even though the Execution Service is TypeScript.** It has to be — it's a library `apps/tool-*` imports directly, and every Tool Runtime is Python. The cost is that the Invocation/Result/manifest contract can't be a shared type definition across the process boundary; it has to be a schema both sides implement against independently, as described above.
- **Mock mode lives inside the real image, not in a separate dev-only image.** This costs a small amount of conditional logic in every entrypoint. It buys the guarantee that local development is exercising the same artifact — not a parallel one that can silently drift from what staging and production actually run.

## Resolve implementation decisions in the owning section

### Design packages/toolkit's internal API before implementation

This page fixes `packages/toolkit`'s responsibilities and the sequence a Tool Runtime follows — not its internal API. Module names, function signatures, file layout, and internal naming inside `packages/toolkit` are unspecified and need their own concrete design pass immediately before implementation begins, not inferred from this page's illustrative descriptions.

### Decide the uv workspace layout

Whether each `apps/tool-*` is an independent `uv` project with `packages/toolkit` as a path dependency, or all Python packages share one `uv` workspace (with GPU- or dependency-conflicted Tools excluded and independently locked), is not decided. CUDA and PyTorch compatibility, upstream dependency conflicts, image build reproducibility, independent Tool releases, editable local development, and CI lock verification are the facts that should decide this once gathered.

### Define the manifest schema's source of truth

Where the Invocation/Result/manifest JSON shape is authoritatively defined, and how the TypeScript Execution Service validates against it independently of `packages/toolkit`'s Python types, is open. A language-neutral schema (for example, JSON Schema generated from `packages/toolkit`'s types, or maintained as its own artifact) is a candidate, not a decision.

### Other open choices already tracked elsewhere

- The Tool Runtime artifact format, registry, and publication mechanism — [`containers.md`](../containers.md).
- Retry policy when a retried Job's original Tool version has been retired — not yet decided by any page.

## Related docs

- [`containers.md`](../containers.md) — the Tool Runtime container responsibilities this page implements.
- [`runtime.md`](../runtime.md) — the Kubernetes Job lifecycle a Tool Runtime executes inside.
- [`deployment.md`](../deployment.md) — the local-development Activity swap that mock mode pairs with.
- [`security.md`](../security.md) — the least-authority rules a Tool Runtime's credentials and network access must satisfy.
- [`data.md`](../data.md) — why staged outputs aren't Job Outputs until finalization commits.
- [`../../product/requirements.md`](../../product/requirements.md) — `TOOL-001` and `TOOL-002`, the discoverable and curated Tool contract this page's per-Tool boundary supports.
