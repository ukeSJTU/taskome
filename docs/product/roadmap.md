# Product roadmap

This roadmap sequences Taskome from its current foundation to open launch. It
defines product milestones and their completion outcomes, not calendar dates,
team assignments, implementation tickets, or architecture.

The [product vision](./vision.md) defines the launch boundary. The
[product requirements](./requirements.md) define the complete acceptance bar.
This page decides the order in which Taskome reaches that bar.

## How to read this roadmap

- Milestones are ordered by dependency. A later milestone may build on every earlier outcome.
- A milestone finishes when its user-visible outcome has been exercised by its
  intended users. Merging code is not sufficient.
- Feature specifications and ADRs may be required within a milestone, but they
  do not become separate product milestones.
- Dates, owners, and issue-level work belong in the issue tracker.
- TODO: 感觉这一行没必要可以删除 The current delivery target is **Milestone 1: First Pocket Detection Job**.

## Launch catalog

Taskome will launch with five curated Tools. A Tool may encapsulate several
internal computation stages while retaining one Job contract and lifecycle.
Internal stages do not make the Tool a Taskome Pipeline.

| Tool                               | Initial Upstream Software | Launch boundary                                                                                                                             |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pocket Detection**               | fpocket                   | Detect and score pockets in one PDB or mmCIF structure. mdpocket, dpocket, and tpocket are excluded from launch.                            |
| **Protein Binder Design**          | BindCraft                 | Generate and filter de novo protein binder candidates in one Job. BindCraft's AlphaFold, ProteinMPNN, and PyRosetta stages remain internal. |
| **Structure Prediction**           | AlphaFold 2               | Predict protein structures and confidence data from supported sequence inputs.                                                              |
| **Fixed-backbone Sequence Design** | ProteinMPNN               | Generate and score candidate sequences for an existing protein backbone.                                                                    |
| **Peptide Mimic Design**           | PepMimic                  | Generate peptide candidates from a known binder-target interface. Training and the RFDiffusion-based no-known-binder path are excluded.     |

Launch also includes the Structure Viewer, MSA Viewer, and Molecule Drawer.
Each Tool and Utility receives its own feature specification before its
contract is considered complete.

## Internal dogfood

Internal dogfood establishes the smallest useful product, then proves the same
product semantics against a second compute shape.

### Milestone 1: First Pocket Detection Job

An authenticated XDenovo scientist can run Pocket Detection through the Web
App and retrieve its results.

Complete when:

- the scientist enters their `Default Project`, discovers the Pocket Detection
  contract, and submits one PDB or mmCIF input with supported parameters;
- Taskome creates one Job and one Attempt and shows meaningful progress or an
  explicit failure;
- a successful Attempt publishes downloadable Job Outputs; and
- the Job records its immutable input, parameters, Tool version, and fpocket
  version as the first reproducible compute record.

Batch submission, retry, full cancellation semantics, the saved-file library,
Utilities, and the programmatic Access Channels do not block this milestone.

### Milestone 2: Reliable compute core

A single Job remains trustworthy when execution waits, fails, is cancelled, or
must be tried again.

Complete when:

- Job and Attempt lifecycle behavior is specified and durable;
- cancellation, retry, failure reporting, and recovery preserve complete
  Attempt history;
- accepted Jobs cannot disappear or execute the same Attempt concurrently;
- immutable inputs and successful Job Outputs retain complete provenance; and
- Project assignment and the minimum scientific-file persistence required by
  these behaviors are available.

This milestone stabilizes product behavior. It does not require completing the
launch platform around a single CPU Tool.

### Milestone 3: Protein Binder Design

An XDenovo scientist can run real BindCraft work through the same Tool, Job,
and Attempt model used for Pocket Detection.

Complete when:

- Protein Binder Design exposes a scientifically reviewed input, parameter,
  and output contract without passing through BindCraft's complete settings;
- long-running GPU execution respects declared resources and remains visible
  while waiting or running;
- each Attempt records allocated resources, actual duration, and the versions
  of BindCraft and its relevant dependencies;
- cancellation, failure, recovery, and published results work for real
  BindCraft executions; and
- XDenovo scientists complete representative Pocket Detection and Protein
  Binder Design runs, including at least one failure, cancellation, or retry
  scenario.

## External beta

External beta begins once the Web product can safely support real research
work. Beta feedback then shapes the remaining launch capabilities while they
are still changeable.

### Milestone 4: External beta foundation

A limited external cohort can use Pocket Detection and Protein Binder Design
through the Web App with private data and production-level support boundaries.

Complete when:

- private Project and scientific-file workflows needed by the beta cohort are
  available without weakening Job provenance;
- the Structure Viewer opens compatible saved structures and Job Outputs;
- user isolation, production security, monitoring, failure diagnosis, and
  recovery meet the external-beta operating bar;
- usage is recorded for every Attempt; and
- Legal and Compliance approve external access to fpocket, BindCraft, and all
  required dependencies under the intended beta conditions.

### Milestone 5: Batch and programmatic access

Beta users can organize repeated compute as Batches and operate Taskome outside
the Web App.

Complete when:

- one submission creates a persistent Batch of independent Jobs for the same
  Tool;
- the Batch page shows membership and aggregate progress without owning
  Attempts or aggregating Job Outputs;
- explicit authorization scopes and revocable programmatic credentials are
  available;
- Direct API Clients cover the programmatic compute, Project, file, result, and
  usage lifecycle required for launch; and
- the CLI supports interactive access and the corresponding compute and data
  management lifecycle.

### Milestone 6: Foundational compute Tools

Beta users can run common structure prediction and inverse-folding work without
entering the full Protein Binder Design workflow.

Complete when:

- Structure Prediction, initially backed by AlphaFold 2, is available through
  the Web App, Direct API Client, and CLI;
- Fixed-backbone Sequence Design, backed by ProteinMPNN, is available through
  the same Access Channels; and
- both Tools preserve the established Job, Attempt, provenance, resource, and
  result semantics.

These Tools remain independently useful capabilities. Their existence does not
introduce Pipeline orchestration at launch.

### Milestone 7: Peptide Mimic Design

Beta users can generate peptide candidates from a known binder-target
interface.

Complete when:

- Peptide Mimic Design exposes a curated PepMimic contract through the Web App,
  Direct API Client, and CLI;
- its Job records the complete input set, parameters, versions, usage,
  and published outputs needed for reproducibility;
- training and the RFDiffusion-based no-known-binder path remain outside the
  Tool contract; and
- Legal and Compliance approve external access to PepMimic, PyRosetta, FoldX,
  and every other required dependency under the intended product conditions.

### Milestone 8: AI-native access

External agents and the Web App's Agent Assistant can use the same stable
product semantics as human and conventional programmatic clients.

Complete when:

- an MCP Agent can complete browser authorization and inspect its granted
  scopes;
- MCP covers the launch compute lifecycle and required Project organization;
- MCP returns safe inline content and download references without forcing large
  files through the agent context;
- the Agent Assistant can explain and discover Tools, submit Jobs, and retrieve
  earlier Job status and results within the current user's authorization; and
- the Agent Assistant does not claim scientific interpretation, comparison, or
  research recommendations as launch capabilities.

### Milestone 9: Browser workbench completeness

The Web App provides the complete launch workspace for organizing and working
with scientific data.

Complete when:

- the MSA Viewer opens supported alignments from saved files and Job Outputs;
- the Molecule Drawer creates or edits supported molecular inputs and saves
  them into a Project;
- Structure Viewer, Project, and saved-file operations satisfy their complete
  launch requirements; and
- Utility actions remain separate from Tool, Job, Attempt, and provenance
  semantics.

The external beta phase completes when its users have exercised representative
workflows across all five Tools and planned Access Channels, and every finding
that blocks launch has been resolved.

## Open launch

### Milestone 10: Launch readiness

Taskome opens registration only after the complete launch contract has evidence
behind it. This milestone closes gaps; it does not add new product capabilities.

Complete when:

- registration is open and production email verification protects compute,
  persistent-file, and credential creation;
- the Web App, MCP Agent, Direct API Client, and CLI each satisfy their launch
  compute lifecycle and channel-specific requirements;
- all five launch Tools and all three launch Utilities are available within
  their approved contracts;
- every product requirement has linked acceptance evidence;
- production scheduling, usage visibility, security, monitoring, failure
  recovery, and operational response have been verified;
- all Upstream Software and dependency uses have final Legal and Compliance
  approval for production and external access; and
- no unresolved beta finding blocks safe or scientifically useful operation.

## Gates that apply throughout

- **Scientific review:** A Tool contract is not complete until its inputs,
  parameters, defaults, constraints, and outputs have been reviewed for its
  intended scientific use.
- **Real-user validation:** Internal and external milestones require
  representative work with real research inputs, not only automated tests or
  demonstrations.
- **Licensing:** Dependency selection can proceed during development, but each
  dependency needs Legal and Compliance approval before production use,
  external access, redistribution, or commercial release.
- **Stable product semantics:** Every Access Channel and Tool preserves the
  canonical Tool, Job, Attempt, Batch, Project, Utility, and provenance
  meanings in [`CONTEXT.md`](../../CONTEXT.md).

## Outside this roadmap

The following material belongs elsewhere:

- post-launch directions and non-goals belong in the
  [product vision](./vision.md);
- complete acceptance criteria belong in the
  [product requirements](./requirements.md);
- feature contracts belong in focused specifications;
- architecture and hard-to-reverse technical decisions belong in architecture
  pages and accepted ADRs; and
- dates, owners, dependencies between implementation tickets, and daily status
  belong in the issue tracker.

## Related docs

- [`vision.md`](./vision.md) — product direction, launch scope, and future
  direction.
- [`requirements.md`](./requirements.md) — checkable launch behavior and
  acceptance criteria.
- [`CONTEXT.md`](../../CONTEXT.md) — canonical domain vocabulary.
- [`docs/README.md`](../README.md) — internal project documentation map.
