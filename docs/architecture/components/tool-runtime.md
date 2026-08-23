# Tool Runtime packaging and `runtime_toolkit`

This page defines how Taskome packages one Upstream Software as an immutable
Tool Runtime. It owns the repository layout, the separation between
Taskome-owned Python code and scientific compute dependencies, upstream source
tracking, container assembly, and Runtime verification.

See [`runtime.md`](../runtime.md) for the Kubernetes Job lifecycle around a
Runtime invocation. See [`containers.md`](../containers.md) for the surrounding
container responsibilities and trust boundaries.

> **Accepted target architecture, not shipped behavior.** The repository has
> an empty `runtimes/` directory and a scaffold at `packages/toolkit`, but no
> implemented Tool Runtime. The scaffold still uses its original package name
> and does not yet implement the design on this page.

## Package one Upstream Software as one release unit

Each independently released Upstream Software runtime lives at
`runtimes/<upstream>`. For example, fpocket and BindCraft live at
`runtimes/fpocket` and `runtimes/bindcraft`.

A Runtime may support more than one Tool only when those Tools share the same
Upstream Software, dependencies, image, and deployment lifecycle. Naming the
directory after the Upstream Software preserves that distinction: a Tool is a
curated product capability, while a Runtime is the execution artifact that
hosts it.

Every Runtime owns:

- its curated input, parameter, and output contracts;
- its adapter around the Upstream Software process;
- its scientific compute environment and upstream identity;
- its Dockerfile; and
- tests through the Python Runtime interface and the final image entrypoint.

Shared Attempt plumbing belongs in `packages/toolkit`, whose target Python
distribution and import package are `runtime-toolkit` and `runtime_toolkit`.
The shared package owns:

| Responsibility                                | Why it is shared                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Invocation and result types                   | Every Runtime accepts the same invocation envelope and produces the same result envelope. |
| Input download and output upload              | Every Runtime uses the same Attempt-scoped Object Storage flow.                           |
| Checksums and manifest generation             | The Execution Service validates one result manifest contract.                             |
| Structured logging and failure classification | Attempt logs and `failure_kind` values must remain consistent across Tools.               |
| Mock invocation mode                          | Every image needs the same GPU-free local-development path.                               |
| Runtime test support                          | Each Runtime verifies the same outer execution sequence.                                  |

Tool-specific parameter models and process adapters stay inside their Runtime.
Moving them into `runtime_toolkit` would turn the shared package into a shallow
registry of unrelated Upstream Software behavior.

## Use one repository shape

Every Runtime follows this layout:

```text
runtimes/fpocket/
├── pyproject.toml
├── src/
│   └── fpocket_runtime/
├── tests/
│   ├── runtime/
│   └── image/
├── compute/
│   ├── pixi.toml
│   ├── pixi.lock
│   ├── upstream.toml
│   └── artifacts.lock.toml  # only when non-package payloads exist
├── Dockerfile
└── README.md
```

The naming convention omits the Taskome product name:

| Repository concept  | fpocket example    |
| ------------------- | ------------------ |
| Directory           | `runtimes/fpocket` |
| Python distribution | `fpocket-runtime`  |
| Import package      | `fpocket_runtime`  |
| Executable          | `fpocket-runtime`  |

Using `fpocket_runtime` avoids colliding with an upstream `fpocket` Python
package. Generic package names such as `adapter` are also invalid because all
Runtime projects share one development workspace.

`artifacts.lock.toml` is optional. Create it only when a Runtime needs models,
licensed binaries, or other byte payloads that neither `pixi.lock` nor
`upstream.toml` identifies. The delivery policy for licensed or very large
artifacts remains Tool-specific.

## Keep uv and Pixi in separate dependency planes

The root uv workspace contains `packages/toolkit` and every `runtimes/*`
project. All Taskome-owned Python packages share the root `uv.lock`, Python
compatibility range, and development tools such as Ruff, ty, and pytest. Each
Runtime still declares its own adapter dependencies in its `pyproject.toml`.
Root Ruff, ty, and pytest configuration applies to the adapter source and
Runtime tests, not to vendored or installed Upstream Software under
`compute/`. Run ty one workspace package at a time so an incomplete Runtime
does not prevent type checking the others.

Production builds install only `runtime_toolkit`, the selected Runtime package,
and their production dependencies into the adapter environment. They do not
install root lint or test dependency groups.

Pixi owns the independent compute environment:

```text
uv
└── Taskome-owned adapter environment
    ├── runtime_toolkit
    ├── fpocket_runtime
    └── adapter dependencies

Pixi
└── Upstream compute environment
    ├── Conda packages and native libraries
    ├── the Upstream Software when available as a package
    └── compute-side PyPI dependencies
```

Dependency ownership follows the process seam:

- place a dependency in `pyproject.toml` when the adapter or
  `runtime_toolkit` imports it;
- place a dependency in `compute/pixi.toml` when the Upstream Software imports
  or executes it; and
- allow the same package to appear independently in both environments when
  both sides genuinely need it.

The adapter never imports a module from the compute prefix. It invokes the
Upstream Software through a subprocess and exchanges configuration, inputs,
outputs, environment variables, stdout, stderr, and exit status. uv and Pixi
never modify the same prefix.

Each Runtime commits `pixi.toml` as human-edited intent and `pixi.lock` as the
exact Linux `x86_64` dependency resolution. A GPU Runtime also records the
CUDA-compatible solve assumptions required by its supported deployment. The
Docker build performs a locked Pixi install; the final image contains the
resulting prefix, not Pixi or a package solver.

## Track source identity independently of dependencies

Every Runtime commits `compute/upstream.toml`. This thin Taskome manifest
identifies the selected upstream source lineage and how the build obtains the
source bytes. It does not duplicate the Pixi dependency graph, a generated
SBOM, or release approval state.

An existing Conda package can deliver the Upstream Software. fpocket has this
shape:

```toml
schema = 1
name = "fpocket"
upstream = "git+https://github.com/Discngine/fpocket.git@<full-commit>"

[delivery]
kind = "pixi-package"
package = "fpocket"
```

`pixi.lock` records the exact package channel, build, URL, and hash. The
upstream manifest records which source revision Taskome reviewed; it does not
pretend that an upstream Git tag alone identifies the packaged bytes.

When Taskome must maintain source changes, XDenovo forks the upstream
repository and publishes a source archive as an explicit GitHub Release asset:

```toml
schema = 1
name = "BindCraft"
source = "git+https://github.com/XDenovo/BindCraft.git@<fork-commit>"
upstream = "git+https://github.com/martinpacesa/BindCraft.git@<upstream-base-commit>"

[delivery]
kind = "archive"
uri = "https://github.com/XDenovo/BindCraft/releases/download/<tag>/source.tar.gz"
sha256 = "<archive-sha256>"
```

The release process uploads a deterministic archive rather than relying on
GitHub's automatically generated source archive. The committed SHA-256 makes a
changed or replaced asset fail closed during the build.

The fork uses two roles:

1. An upstream-tracking branch mirrors the official repository without
   Taskome changes.
2. A Runtime branch carries small, independently reviewable Taskome commits on
   one approved upstream base.

An upgrade rebases the Runtime commits onto a new approved upstream base. If
upstream accepts one of those commits, the next rebase removes the local copy.
Release tags such as `v1.5.3-r1` or `git-efb5bf-r1` identify the source archive
used by Taskome.

The top-level `references/` directory has no release role. Its submodules are
temporary, read-only research checkouts used while studying external projects.
A Runtime build, source identity, or test must not depend on a corresponding
reference checkout, and the reference may be removed after implementation.

## Build from the monorepo root

Every Runtime has its own Dockerfile, but every image uses the monorepo root as
its build context:

```text
docker build -f runtimes/fpocket/Dockerfile .
```

The root context is required because the adapter build consumes the shared
`uv.lock` and `packages/toolkit`. A restrictive root `.dockerignore` excludes
reference checkouts, unrelated generated data, local environments, and caches
from the context.

Root mise tasks provide the stable developer and CI interface:

```text
mise run runtime:lock -- fpocket
mise run runtime:source:fetch -- bindcraft
mise run runtime:build -- fpocket
mise run runtime:test:image -- fpocket
mise run runtime:check -- fpocket
```

The normal build command reads `upstream.toml`, downloads the declared GitHub
Release asset when required, verifies its SHA-256, and passes the verified
source to Docker. A separate fetch command exists for diagnosis; developers do
not need to run it before the normal build.

The implementation behind these tasks belongs under `scripts/runtime/`.
Repository build and release concerns must not enter `runtime_toolkit`, which
ships in the Runtime image.

Each Dockerfile has independent adapter-builder, compute-builder, and final
stages. CPU and GPU Runtimes may choose different pinned base images and system
libraries. They do not share a conditional universal Dockerfile or a shared
base image until implemented Runtimes demonstrate stable duplication worth
extracting.

## Enforce one final image contract

Every final Runtime image uses the same paths:

```text
/opt/taskome/adapter/    # uv-built adapter environment
/opt/taskome/compute/    # Pixi-built compute prefix
/opt/taskome/upstream/   # unpacked source when delivery is an archive
/opt/taskome/artifacts/  # immutable non-package payloads
/work/                   # one Attempt's writable workspace
```

The image:

- runs as a fixed non-root user;
- treats `/opt/taskome/**` as read-only;
- writes only to `/work` and explicitly provided temporary locations;
- omits uv, Pixi, package solvers, compilers, and other build-only tools;
- enters through the unique `<upstream>-runtime` executable; and
- invokes the Upstream Software only through the subprocess seam.

The deployment layer selects physical GPUs by limiting which devices the
container can see. The Runtime passes container-local device identities to the
Upstream Software and removes or neutralizes upstream attempts to choose host
physical GPU IDs.

## Run one Attempt, then exit

A Tool Runtime performs the same outer sequence for every Tool:

1. Read the Attempt invocation, scoped input references, parameters, and
   Object Storage staging target.
2. In mock mode, produce deterministic fixture output without Object Storage,
   a GPU, or real Upstream Software execution.
3. Otherwise download the immutable inputs into the Attempt workspace and run
   the Tool-specific adapter.
4. Validate the expected outputs, build the result manifest, and upload both
   manifest and output files to the Attempt staging namespace.
5. Exit with a status that distinguishes success from configuration,
   Upstream Software, infrastructure, cancellation, and publication failure.

The Runtime never receives a Temporal, Kubernetes, Application Database, or
user credential. It receives only one Attempt-scoped Object Storage grant.

The result manifest travels through Object Storage because the Runtime has no
direct call path to the Execution Service. Once the Kubernetes Job terminates,
the Execution Service reads and validates the staged manifest before it commits
Job Output records. The manifest remains a language-neutral schema implemented
independently by the TypeScript Execution Service and Python
`runtime_toolkit`.

## Test the two public seams

Runtime tests use two public seams:

```text
tests/
├── runtime/  # Python Runtime interface with a fake upstream subprocess
└── image/    # final OCI image entrypoint
```

Runtime-interface tests cover curated input translation, subprocess arguments,
configuration generation, failure classification, output validation, and
manifest construction. They do not run scientific compute.

Image tests verify that the adapter and compute prefixes cooperate, required
executables and dynamic libraries exist, the image runs as non-root, immutable
paths remain read-only, mock mode needs no network access, and the entrypoint
produces the expected output contract. Real execution still uses the adapter's
Attempt-scoped Object Storage access; the Upstream Software must not perform
undeclared downloads.

CI uses three levels:

1. Every pull request runs Ruff, ty, and the fast Runtime-interface tests.
2. A change under one Runtime validates its locks, builds its final image, and
   runs that image in mock mode. A small CPU Tool may also run a real smoke
   fixture.
3. Release or explicit qualification jobs run real compute on the required CPU
   or GPU runner and verify output invariants, resources, and the absence of
   undeclared compute-time downloads.

Host development does not support real compute as a second execution path.
Developers run adapter tests on the host and real Upstream Software through the
same image that production uses.

## Pin Runtime releases by digest

The OCI digest is the authoritative Runtime artifact identity. Kubernetes Jobs
use the digest, never only a mutable image tag.

A human-readable tag combines the upstream base with a Taskome Runtime
revision:

```text
ghcr.io/xdenovo/fpocket-runtime:4.2.3-r1
ghcr.io/xdenovo/bindcraft-runtime:1.5.3-r2
```

Increment `rN` when the adapter, Pixi lock, source patches, artifacts, or image
assembly changes without changing the upstream version. Tool contract versions
remain independent. A published Tool binds its Tool contract version, upstream
identity, declared resources, and immutable Runtime digest.

GitHub Container Registry stores final Runtime images. Builds generate an SBOM
and provenance from the verified source manifest, Pixi lock, uv lock, external
artifact lock, base-image digest, Taskome commit, and resulting OCI digest. The
exact SBOM format, signing mechanism, vulnerability scanner, registry retention
policy, and admission verification remain unresolved security and deployment
choices.

## Keep Tool-specific decisions with the Tool

The shared structure does not force false scientific uniformity. Each Runtime
still decides:

- its curated Tool contracts and supported upstream subcommands;
- CPU, GPU, memory, CUDA, and model requirements;
- which stochastic controls and output invariants it can promise;
- the success threshold for candidate-generating computations;
- how licensed or very large artifacts enter an approved deployment; and
- its real-compute qualification fixtures and tolerances.

These choices must not weaken the shared dependency, source identity, image,
process, and verification contracts on this page.

## Resolve the remaining implementation choices at their owning seams

The following choices remain open:

- the internal Python interface of `runtime_toolkit`;
- the language-neutral Invocation, Result, and manifest schema source of truth;
- the implementation language and detailed interface of `scripts/runtime/`;
- exact Docker base images and CUDA compatibility per Runtime;
- the schema and delivery modes for optional licensed or large artifacts; and
- SBOM, signing, scanning, retention, and admission-verification mechanisms.

## Related docs

- [`containers.md`](../containers.md) — Container responsibilities and Runtime
  artifact publication.
- [`runtime.md`](../runtime.md) — Job and Attempt submission, observation,
  cancellation, and finalization.
- [`deployment.md`](../deployment.md) — local image execution and production
  workload placement.
- [`security.md`](../security.md) — least authority, immutable artifacts, and
  runtime isolation.
- [`data.md`](../data.md) — staged output validation and authoritative Job
  Outputs.
- [`../../engineering/testing.md`](../../engineering/testing.md) — repository
  test seams and commands.
