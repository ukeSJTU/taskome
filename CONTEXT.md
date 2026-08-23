# Taskome

Taskome is XDenovo's platform for running, managing, and reproducing protein-design compute. This glossary defines the shared product language used across Taskome's interfaces, documentation, and code.

## Compute

**Tool**:
A curated, reusable compute capability provided by one Upstream Software through Taskome. A Tool may encapsulate multiple internal stages and software dependencies, but one invocation creates one Job with one input, parameter, and output contract. Tools backed by different Upstream Software remain distinct even when they serve the same scientific purpose.
_Avoid_: Task, Model; qualify an MCP protocol primitive as an MCP Tool.

**Upstream Software**:
Scientific software from which Taskome curates one or more Tools, such as BindCraft or PepMimic. Each Tool has exactly one Upstream Software; other software it uses internally is an implementation dependency, not an additional provider of that Tool.
_Avoid_: Tool, when referring to the software that Taskome packages.

**Job**:
An immutable request to run one Tool with fixed inputs and parameters. A Job keeps its identity when Taskome makes another Attempt to execute it.
_Avoid_: Run, Submission.

**Attempt**:
One accepted try to carry out a Job, created the moment Taskome accepts the try and continuing through its outcome — including one cancelled or failed before scientific execution starts. Each retry creates another Attempt under the same Job.
_Avoid_: Run; use Job for the request and Attempt for each try to carry it out.

**Job Output**:
An immutable file published as a result by a successful Attempt and belonging to its Job. Logs, temporary files, and partial files from unsuccessful Attempts are not Job Outputs.
_Avoid_: Artifact, Result File, Output File.

**Batch**:
A persistent record of multiple independent Jobs for the same Tool created by one submission. Its members execute independently; a Batch has no Attempts, Job Outputs, or execution lifecycle of its own.
_Avoid_: Pipeline, Job.

**Pipeline**:
A first-class Taskome object that coordinates multiple Jobs and their declared data dependencies. Each Job keeps its own lifecycle and results; stages hidden inside one Tool do not form a Pipeline.
_Avoid_: Tool, Batch; use internal stages for computation hidden within one Tool.

## Organization and utilities

**Project**:
A private, persistent container that organizes a user's related Jobs and scientific files. Project membership does not change ownership, provenance, or execution dependencies.
_Avoid_: Pipeline, Folder.

**Utility**:
A browser-based capability for viewing, inspecting, or preparing scientific data without creating a Job or Attempt.
_Avoid_: Tool; Tools run compute through Jobs, while Utilities do not.

## Access

**Access Channel**:
One of the four product journeys into Taskome: the Web App, an MCP Agent, a Direct API Client, or the CLI. An Access Channel describes how a user reaches the product, not an interface protocol or credential type.
_Avoid_: Interface, Authentication Method.

**MCP Agent**:
An external AI agent that acts for a user through Taskome's MCP access channel.
_Avoid_: Agent Assistant.

**Direct API Client**:
A user-controlled program or service that calls Taskome's API directly rather than through the Web App or Taskome's CLI.
_Avoid_: Agent, API User, CLI.

**CLI**:
Taskome's own command-line client. Unlike a Direct API Client, Taskome builds and distributes it as part of the product.
_Avoid_: Direct API Client.

**Agent Assistant**:
The AI assistant built into Taskome's Web App. It is part of the Web App rather than an external MCP Agent or a separate Access Channel.
_Avoid_: MCP Agent, Access Channel.
