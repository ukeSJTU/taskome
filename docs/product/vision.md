# Vision

Taskome is XDenovo's platform for running, managing, and reproducing protein-design compute. It gives scientists one curated product for submitting work, tracking its execution history, and working with scientific files from a browser, an AI agent, a CLI, or a direct API client—without rebuilding the environment and integration for each Upstream Software package.

XDenovo builds AI-native biotech products. Taskome is one of those products, not the company itself. This internal document defines Taskome's product direction, launch boundary, and non-goals. It is not external marketing copy, a delivery plan, or an architecture specification.

## The problem Taskome solves

Protein-design work depends on a growing collection of compute-intensive programs. The work includes protein design itself and the directly supporting steps around it, such as structure prediction, pocket detection, docking, scoring, and computational evaluation.

Without a shared platform, each team has to solve the same operational problems:

- install and maintain a different compute environment for every scientific program;
- decide which parameters belong in a usable scientific interface;
- build separate integrations for browser, agent, CLI, and API access;
- track which inputs, parameters, Upstream Software versions, and executions produced each output; and
- move scientific files between compute tools and separate desktop or browser utilities.

Taskome centralizes these concerns so a new compute capability becomes part of one consistent product instead of another one-off installation. At launch, Taskome helps users run compute and inspect its inputs, execution history, and outputs; it does not decide their scientific strategy or interpret whether a result is biologically good.

## The product boundary

Taskome covers protein design and the compute capabilities that directly support a protein-design workflow. It is not a general-purpose bioinformatics platform. A capability belongs in Taskome when it helps users prepare, generate, evaluate, or inspect protein-design inputs and outputs.

The compute catalog is curated. Taskome exposes the scientifically meaningful controls of Upstream Software rather than either hiding its real configuration behind an oversimplified no-code surface or passing through every available flag without product judgment. The exact catalog and its delivery order belong in the [product roadmap](./roadmap.md).

## How Taskome fits together

Taskome combines managed compute, project organization, and browser-based scientific utilities. These are separate product capabilities connected through the scientific files and results that users work with.

### Compute: Tools, Jobs, Attempts, and Batches

Taskome models compute through four concepts:

- A **Tool** is a curated, reusable compute capability. It defines the inputs, parameters, and outputs that Taskome supports for Upstream Software.
- A **Job** is one immutable user request to run a Tool with a fixed set of inputs and parameters.
- An **Attempt** is one actual execution made to complete a Job. A Job may have more than one Attempt when execution has to be tried again.
- A **Batch** is a persistent record of multiple independent Jobs for the same Tool created by one submission. It groups the Jobs without owning their execution lifecycle or results.

Changing a Job's Tool, inputs, or parameters creates a new Job. Re-executing the same request creates another Attempt under the existing Job. The successful Attempt supplies the Job's results, while the complete Attempt history supports traceability and reproducibility.

### Projects organize research work

A **Project** is a private, persistent container for organizing Jobs and saved scientific files that relate to the same research goal. A Project does not change who owns or can access its contents, and it does not create execution dependencies between Jobs.

Users can move a Job or saved file between Projects without changing its identity or provenance. Attempts and Job Outputs follow their Job rather than receiving separate Project assignments. Future capabilities may also use Projects as an organizing context without changing this definition.

### Utilities work with scientific data

A **Utility** is a browser-based capability for viewing, inspecting, or preparing scientific data without creating a Job or Attempt. Utilities may have standalone entry points, but they also integrate with files and results throughout Taskome.

For example, a user can open a PDB Job Output directly in the Structure Viewer instead of downloading it and opening it in PyMOL. The same Utility can open a saved PDB file from a Project without turning that interaction into a compute Job.

## Who Taskome is for

Taskome is designed first for XDenovo's protein-design teams and early external protein-design researchers. Registration is open, and every launch account is an individual account.

Each user owns and can access only their own Projects, Jobs, Attempts, input files, Job Outputs, and programmatic credentials. Launch does not introduce organizations, teams, roles, or cross-user sharing. Flat accounts describe the collaboration model; they do not imply shared data visibility.

## Prior art

Taskome builds on product patterns already established by adjacent platforms:

| Reference                                 | Relevant pattern                                                                                                       | What Taskome takes from it                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [Tamarind Bio](https://www.tamarind.bio/) | A large catalog of hosted bioinformatics tools available through a web product and programmatic access, including MCP. | One platform can make many compute tools consistently accessible without requiring users to operate each tool themselves.      |
| [subseq.bio](https://subseq.bio/docs)     | A protein-design workbench for configuring jobs, tracking progress, inspecting results, and connecting compute steps.  | Scientific users benefit from access to meaningful underlying configuration rather than an oversimplified no-code abstraction. |
| [ProteinIQ](https://proteiniq.io/)        | Browser-based bioinformatics tools, projects, files, result inspection, workflows, and a consistent job API.           | Compute, project organization, scientific utilities, and result inspection should feel like parts of one product.              |

These references inform interaction patterns, not Taskome's scope. In particular, their broader catalogs or workflow systems do not make those capabilities launch requirements for Taskome.

## Launch scope

Launch scope is everything that must be true before Taskome is deployed to production and begins serving real users. This section defines the completion bar, not implementation order. The [product roadmap](./roadmap.md) owns sequencing and milestones.

### Access channels

Every Tool is available through four access channels with the same Tool, Job, and Attempt semantics:

- **Web App** — the browser interface for organizing Projects, discovering Tools, submitting Jobs, viewing execution history, managing files, and inspecting results.
- **MCP Agent** — an external AI agent acting for a user through Taskome's MCP interface.
- **Direct API Client** — a user-controlled script or service calling Taskome's REST API.
- **CLI** — Taskome's own command-line client for interactive and automated use.

Programmatic access supports explicit, revocable scopes so a credential or delegated client receives only the actions the user grants. The exact scope names, authentication flows, and credential types belong in requirements and architecture documentation.

The Web App also includes a built-in Agent Assistant. It helps a user discover and understand Tools, submit Jobs, and retrieve the status and outputs of the user's earlier Jobs. The assistant is part of the Web App, not a fifth access channel. Scientific interpretation, comparison, and research recommendations remain outside launch scope.

### Compute and results

- Launch Tools run inference and other non-training compute. Model training is outside launch scope.
- Users can submit a Batch of independent Jobs for the same Tool and reopen its dedicated page to inspect the members and their aggregate progress. Each Job runs and reaches an outcome independently; the Batch does not aggregate results and is not a pipeline.
- The platform schedules the CPU and GPU resources required by Tools at a level suitable for day-to-day production use.
- Every actual execution is recorded as an Attempt. If a Job is executed more than once, the platform preserves each Attempt instead of hiding retry history.
- Every Job Output is traceable to the Job inputs and parameters, the Attempt that produced it, and the exact Tool and Upstream Software versions used by that Attempt.

The queue, scheduler, retry policy, and runtime topology that achieve these outcomes are architecture decisions, not part of the product vision.

### Integrated utilities

Launch includes these browser-based Utilities:

- **Structure Viewer** for inspecting molecular structures, including PDB Job Outputs;
- **MSA Viewer** for inspecting multiple sequence alignments; and
- **Molecule Drawer** for creating or editing molecular inputs.

The Utility catalog can grow over time. The roadmap owns additions and delivery order beyond this launch commitment.

### Project organization

Launch includes private Project management for keeping related Jobs and saved files together. Project assignment remains organizational: users can reorganize their work without changing Job identity, Attempt history, provenance, ownership, or access. A Project does not turn its Jobs into a pipeline.

### Accounts and usage

- Registration remains open.
- Accounts remain flat and individual, with private per-user data.
- Projects remain private to their individual owner.
- Taskome records resource usage so there is a factual basis for future billing.
- Launch has no payment, credits, or billing system. Metering creates an accurate usage record; it does not charge the user.

## Launch non-goals

Taskome does not need the following capabilities before launch:

- general-purpose bioinformatics tools unrelated to protein-design workflows;
- pipeline orchestration between Jobs;
- model training;
- scientific interpretation of results or recommendations about what to do next;
- payments, credits, or billing;
- cross-user sharing and collaboration; or
- organizations, teams, roles, and multi-tenant administration.

## Future direction

The following capabilities are credible directions, but they have no committed design or timeline and do not block launch:

- **Pipeline orchestration** — connecting one Job's outputs to another Job's inputs as a reproducible workflow.
- **Training Tools** — extending the catalog beyond inference and supporting compute.
- **Scientific result assistance** — interpreting and comparing outputs, explaining their biological significance, and helping users choose next steps.
- **Payments and credits** — charging against the resource usage that Taskome records.
- **Collaboration and multi-tenancy** — sharing inputs, Jobs, results, and pipelines through organizations, teams, roles, and permissions.
- **Larger-scale scheduling** — allocating compute across more resources and machines when launch-scale scheduling is no longer sufficient.

## Related docs

- [`roadmap.md`](./roadmap.md) — the concrete Tool and Utility roster, delivery order, and milestones.
- [`requirements.md`](./requirements.md) — checkable product behavior and acceptance criteria derived from this vision.
- [`CONTEXT.md`](../../CONTEXT.md) — Taskome's canonical domain vocabulary.
- [`docs/README.md`](../README.md) — documentation status and the rewrite sequence.
