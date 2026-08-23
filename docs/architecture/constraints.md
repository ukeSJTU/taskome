# Architecture constraints

This page records the launch constraints that limit Taskome's architecture.
A constraint is a condition the team cannot freely change while designing the
system. Product requirements, accepted architecture decisions, current
implementation choices, and general engineering principles belong in their
own documents instead of being repeated here as constraints.

Taskome currently has three confirmed architecture constraints. If a future
constraint materially changes the available solution space, add it here and
revisit the affected architecture decisions.

## Operate without a dedicated platform team

A small product engineering team builds and operates Taskome. The team does
not have a dedicated SRE or platform engineering function.

This limits the operational burden the architecture may introduce:

- every production component must have a clear owner and an understandable
  failure and recovery model;
- routine deployment, upgrades, backup, restoration, and incident diagnosis
  must remain feasible for the product engineering team; and
- adding self-hosted infrastructure requires evidence that its product or
  reliability benefit justifies its ongoing operational cost.

Managed services remain allowed but are not required. The deployment design
must evaluate their cost, control, reliability, and operational trade-offs
rather than assuming either self-hosting or managed infrastructure by default.

## Target one Tool Runtime platform for launch

Launch Tool Runtimes target Linux on `x86_64`. A Tool that requires GPU compute
uses NVIDIA GPUs through CUDA. Launch does not require Tool Runtime support for
Windows, macOS, Linux on ARM, AMD GPUs, or other accelerator platforms.

This constraint applies to the environment that executes Upstream Software. It
does not define supported developer workstations, Web App browsers, or CLI
platforms. Those compatibility promises belong in their respective product or
engineering specifications.

Specific NVIDIA GPU models, CUDA versions, driver versions, and minimum
resource sizes remain Tool and deployment decisions. Each published Tool must
record the runtime and resource requirements needed to schedule and reproduce
its Attempts.

## Treat third-party licensing as a release gate

Taskome may use third-party software during development only under licenses or
evaluation access currently authorized for that development context. The team
must record every third-party dependency, including Upstream Software packaged
inside Tool Runtimes.

Legal and Compliance approval is required before any third-party dependency is
used in production, made available to external users, redistributed, or
included in a commercial release. Development use does not imply approval for
any of those later stages.

This gate requires Taskome to preserve the identity and version of software in
each Runtime artifact and to keep the dependency inventory reviewable. The
product roadmap may require approval at an earlier beta milestone, but it
cannot waive this release gate.

## Do not infer constraints from the current repository

The following conditions are not confirmed architecture constraints:

| Condition                            | Why it is not a constraint                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local Docker Compose**             | The current `compose.yml` starts development support services. It does not prescribe production topology.                                                                                                  |
| **Current application frameworks**   | Node.js, Hono, Better Auth, Drizzle, and the Go CLI are implementation baselines. Except for separately accepted architecture decisions, they are not permanently mandated by this page.                   |
| **Single-machine deployment**        | Launch may use one machine, multiple machines, or managed infrastructure. The Kubernetes distribution and production hosting remain unresolved.                                                            |
| **A specific cloud or orchestrator** | No cloud provider, region, on-premises environment, Kubernetes platform, or prohibition on managed services has been imposed.                                                                              |
| **Numeric service levels**           | No launch target currently defines availability, throughput, concurrency, Job duration, RPO, or RTO. This does not weaken requirements against silent loss or duplicate execution of one Attempt.          |
| **Additional regulatory regimes**    | No data-residency, HIPAA, GxP, export-control, audit-retention, or deletion-deadline constraint has been confirmed. User isolation and telemetry data boundaries remain product and security requirements. |

PostgreSQL, Temporal, Kubernetes, the Control Plane and Execution Service
boundaries, and immutable Tool Runtimes appear in the target architecture
because they are accepted decisions—not because the current development
environment forces them. Reconsider those decisions through the architecture
and ADR process rather than silently reclassifying them as constraints.

## Update this page when the solution space changes

Add or revise a constraint when an organizational, legal, hardware, platform,
regulatory, or contractual condition removes otherwise viable architecture
options. When that happens:

1. state the condition without prescribing more implementation than it
   requires;
2. identify which accepted decisions and unresolved choices it affects; and
3. update the owning architecture pages or record a consequential decision in
   an ADR.

Record product outcomes in product requirements, implemented behavior in code
and application READMEs, engineering rules in `AGENTS.md` or engineering docs,
and solution choices in architecture pages. Keeping those categories separate
prevents a temporary implementation detail from becoming an accidental
long-term restriction.

## Related docs

- [`overview.md`](./overview.md) — accepted solution strategy and unresolved
  architecture choices.
- [`containers.md`](./containers.md) — target containers, data ownership, and
  dependency directions.
- [`requirements.md`](../product/requirements.md) — product and quality outcomes
  that every solution must satisfy.
- [`roadmap.md`](../product/roadmap.md) — milestone-specific Legal and Compliance
  gates for launch Tools.
- [`AGENTS.md`](../../AGENTS.md) — repository-wide engineering and licensing
  principles.
- [`docs/README.md`](../README.md) — document status and source-of-truth rules
  during the architecture rewrite.
