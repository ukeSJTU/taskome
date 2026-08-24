# Product requirements

This page defines the checkable product behavior that Taskome must provide before launch. The [product vision](./vision.md) defines why these requirements exist; the [product roadmap](./roadmap.md) decides when they are delivered.

These requirements describe outcomes, not implementation choices. Feature specifications may refine them but must not silently weaken them. Temporary development behavior, including a single broad authorization scope, does not satisfy a stricter launch requirement unless this page is deliberately revised.

## Tool contracts

- **TOOL-001 — Discoverable contract.** Before submitting a Job, a user must be able to discover a Tool's supported inputs, parameters, defaults, validation constraints, and outputs.
- **TOOL-002 — Curated surface.** Every Tool contract must be deliberately reviewed for scientific usefulness. Taskome must not expose the complete configuration of Upstream Software merely because those options exist upstream.
- **TOOL-003 — Stable semantics across channels.** A Tool invoked with the same inputs and parameters must retain the same Job and Attempt semantics regardless of the access channel used.
- **TOOL-004 — Launch compute boundary.** Launch Tools must perform inference or other non-training compute. Model training does not satisfy the launch Tool scope.

## Access channels

The Web App, MCP Agent, Direct API Client, and CLI must all support the core compute lifecycle:

- list and search Tools;
- inspect Tool contracts and human-oriented Tool documentation;
- submit one Job or a batch of independent Jobs;
- list and search the user's Jobs;
- read Job status, metadata, Attempt history, and execution errors;
- cancel a queued or running Job;
- retry an unsuccessful Job;
- inspect Job results; and
- list saved files and use a saved file as Job input.

The channels do not need identical interfaces or transport payloads. The following channel-specific requirements define their intended differences.

### Web App

- **WEB-001 — Account access.** The Web App must support account creation, sign-in, and sign-out.
- **WEB-002 — Authorization management.** The Web App must support browser-based MCP authorization and the creation, inspection, and revocation of programmatic credentials and grants.
- **WEB-003 — Project and file management.** The Web App must support all launch Project and saved-file operations, including archive, delete, upload, and download where applicable.
- **WEB-004 — Browser capabilities.** The built-in Agent Assistant and launch Utilities must be available through the Web App.
- **WEB-005 — Usage visibility.** A user must be able to inspect their recorded resource usage in the Web App.

### MCP Agent

- **MCP-001 — Browser authorization handoff.** An MCP Agent must be able to initiate authorization that the user completes through the Web App.
- **MCP-002 — Project organization.** An MCP Agent must be able to list, create, and rename Projects and move Jobs or saved files between them. Project archive and deletion are not required through MCP.
- **MCP-003 — File-safe results.** MCP access to Job results and saved files must provide structured metadata, content that is safe to return inline, and references for downloading larger content. MCP must not require large file bytes to pass through the agent's context.
- **MCP-004 — File mutation boundary.** Uploading, downloading, and deleting saved files are not required through MCP.
- **MCP-005 — Scope visibility.** An MCP client must be able to inspect the scopes granted to it.

### Direct API Client

- **API-001 — Non-interactive access.** A Direct API Client must authenticate with a previously created programmatic credential. It does not need an interactive sign-in flow.
- **API-002 — Programmatic management.** The API must support the core compute lifecycle, Project management, saved-file management, Job Output downloads, and usage inspection.
- **API-003 — Scope visibility.** An API client must be able to inspect the scopes granted to its current credential.
- **API-004 — Browser exclusions.** Account creation, interactive authorization, Utilities, and the built-in Agent Assistant are not required through the API.

### CLI

- **CLI-001 — Interactive access.** The CLI must support interactive sign-in and sign-out.
- **CLI-002 — Compute and data management.** The CLI must support the core compute lifecycle, Project management, saved-file management, Job Output downloads, and usage inspection.
- **CLI-003 — Scope visibility.** The CLI must be able to inspect the scopes granted to its current authorization.
- **CLI-004 — Browser exclusions.** Account creation, MCP client authorization, Utilities, and the built-in Agent Assistant are not required through the CLI.

## Accounts and authorization

- **AUTH-001 — Open registration.** Any visitor must be able to register an individual account without an invitation or manual approval.
- **AUTH-002 — Verified production access.** A user must verify their email address before they can submit Jobs, persist scientific files, or create programmatic credentials in production.
- **AUTH-003 — Private ownership.** A user must not be able to discover, read, modify, or delete another user's Projects, Jobs, Attempts, saved files, Job Outputs, usage, or credentials.
- **AUTH-004 — Flat accounts.** Launch authorization must not depend on organizations, teams, roles, or cross-user sharing.
- **AUTH-005 — Explicit scopes.** Every programmatic grant or credential must carry explicit scopes by launch. An operation outside those scopes must be rejected.
- **AUTH-006 — Owner boundary.** Scopes may reduce what a programmatic caller can do, but they must never grant access beyond the owning user's data.
- **AUTH-007 — Revocation.** After a revocation operation succeeds, the revoked grant or credential must fail on its next attempted use.

The production email-verification requirement does not require local development or automated tests to deliver real email. The exact development workflow belongs in engineering documentation.

The exact scope names, scope granularity, credential types, and authorization flows belong in the authorization specification. An early development version may use one broad scope, but that is not sufficient for launch.

## Projects

- **PROJECT-001 — Default Project.** Every account must have exactly one private system Project named `Default Project`. Its name is fixed, but its description remains editable.
- **PROJECT-002 — Required assignment.** Every Job and saved file must belong to exactly one Project. Attempts and Job Outputs must inherit the Project of their Job rather than receiving independent Project assignments.
- **PROJECT-003 — Organizational only.** Project assignment must not change ownership, access, Job execution order, or dependencies between Jobs.
- **PROJECT-004 — Reorganization.** A user must be able to move a Job or saved file between their Projects without changing its identity, Job fields, Attempt history, or provenance.
- **PROJECT-005 — Cross-Project file reuse.** A user must be able to use a saved file from one Project as input to a Job in another Project without duplicating the stored content.
- **PROJECT-006 — Archive.** A user must be able to archive and restore a non-default Project without changing or deleting its contents. An archived Project must not accept new Jobs or saved files, or allow metadata edits, until restored.
- **PROJECT-007 — Safe deletion.** `Default Project` must not be archivable or deletable. A non-default Project may be deleted only when it is empty, and deleting a Project must never cascade to Jobs, Attempts, Job Outputs, or saved files.
- **PROJECT-008 — Implicit assignment.** When a Job or saved-file creation request omits a Project, Taskome must assign it to the owner's `Default Project`.
- **PROJECT-009 — Names.** Project names must be unique per user across active and archived Projects after trimming and Unicode normalization, with case-insensitive comparison.

## Jobs and Attempts

- **JOB-001 — Immutable request.** After a Job is created, its Tool, inputs, and parameter values must not change. Any change to them requires a new Job.
- **JOB-002 — Independent submission identity.** Every ordinary submission must create a new Job, even when another Job has identical inputs and parameters. Taskome must not merge ordinary submissions based only on payload equality.
- **JOB-003 — Retry identity.** Re-executing an unsuccessful Job through an explicit or automatic retry must create a new Attempt under that Job. It must not overwrite an earlier Attempt or create a replacement Job.
- **JOB-004 — Successful rerun.** Running the same work again after a Job succeeds must create a new Job.
- **JOB-005 — Complete Attempt history.** Every actual execution of a Job must have its own durable Attempt record. Earlier Attempts must remain visible instead of being replaced by the latest execution state.
- **JOB-006 — Cancellation.** A user must be able to request cancellation of a queued or running Job through every access channel. The platform must report whether it accepted the request and must expose the Job's eventual outcome.

The compute-lifecycle specification will define Job and Attempt states, automatic retry conditions, cancellation races, retry limits, and terminal-outcome rules before implementation of those behaviors is considered complete.

## Batches

- **BATCH-001 — Durable grouping.** One batch submission must create a Batch with a stable identity and immutable membership containing multiple Jobs for the same Tool.
- **BATCH-002 — Batch visibility.** The Web App must provide a dedicated page where a user can reopen a Batch, inspect its member Jobs, and view aggregate progress derived from their states.
- **BATCH-003 — Independent Jobs.** Failure, cancellation, or retry of one member Job must not change the lifecycle or result of another member Job.
- **BATCH-004 — Result boundary.** A Batch must not own Attempts or Job Outputs, aggregate member results, or have an execution lifecycle independent of its member Jobs.
- **BATCH-005 — No implicit pipeline.** A Batch must not create execution dependencies or pass outputs between its Jobs.

## Provenance and files

- **PROV-001 — Output provenance.** Every Job Output must be traceable to the immutable Job inputs and parameters, the Attempt that produced it, and the exact Tool and Upstream Software versions used by that Attempt.
- **PROV-002 — Attempt-specific versions.** Each Attempt must record the versions it actually executed. Retrying a Job after a deployment must not rewrite the versions recorded for earlier Attempts.
- **PROV-003 — Published outputs.** Only a successful Attempt may publish Job Outputs. Logs, temporary files, and partial files from unsuccessful Attempts must not be presented as Job Outputs.
- **FILE-001 — Immutable Job input.** A Job must remain bound to the exact file content submitted as its input. Moving, renaming, editing, replacing, or deleting a saved file later must not change the Job or make its provenance ambiguous.
- **FILE-002 — Historical independence.** Removing a saved file from the user's file library must not remove the immutable input record required by an existing Job.
- **FILE-003 — Project movement.** Moving a Job between Projects must move its Attempt and Job Output context with it without changing object identity or provenance.

The mechanism used to preserve file content and provenance—such as snapshots, immutable versions, or content-addressed storage—is an architecture decision.

## Integrated Utilities

- **UTILITY-001 — Separate execution model.** Viewing, inspecting, editing, or saving data through a Utility must not create a Tool, Job, or Attempt.
- **UTILITY-002 — Structure Viewer integration.** The Structure Viewer must open supported saved molecular-structure files and compatible Job Outputs directly in the Web App, including PDB outputs.
- **UTILITY-003 — MSA Viewer integration.** The MSA Viewer must open supported saved multiple-sequence-alignment files and compatible Job Outputs directly in the Web App.
- **UTILITY-004 — Molecule Drawer integration.** The Molecule Drawer must create or edit a supported molecular input and save the result as a scientific file in a Project.
- **UTILITY-005 — Provenance isolation.** Utility operations on a saved file or Job Output must not mutate the Tool, inputs, parameters, Attempt history, or provenance of an existing Job.

Each Utility's supported formats, interaction behavior, and validation rules belong in its feature specification.

## Built-in Agent Assistant

- **AGENT-001 — Launch capabilities.** The Agent Assistant must help a user discover and understand Tools, submit Jobs, and retrieve the status and results of the user's earlier Jobs.
- **AGENT-002 — User boundary.** The Agent Assistant must act within the current user's authorization and must not expose or operate on another user's data.
- **AGENT-003 — Scientific boundary.** At launch, the Agent Assistant must not present scientific interpretation, cross-result comparison, biological conclusions, or research recommendations as Taskome capabilities.

Human confirmation policy, knowledge retrieval, citations, conversation retention, and tool-level permission design belong in the Agent Assistant specification.

## Scheduling and usage

- **EXEC-001 — Visible waiting.** When required compute is unavailable, a submitted Job must remain visible with a non-terminal status rather than disappearing or being reported as successful.
- **EXEC-002 — Declared resources.** Tool execution must respect the CPU and GPU resource requirements declared for the Tool.
- **EXEC-003 — No silent loss.** The platform must not silently discard an accepted Job. A user must be able to query a result, a non-terminal status, or an explicit terminal failure.
- **EXEC-004 — Attempt identity.** Delivery or coordination retries must not cause the same Attempt to execute concurrently more than once.
- **USAGE-001 — Attempt-level recording.** Every Attempt must record its allocated compute resources and actual execution duration, whether it succeeds, fails, or is cancelled.
- **USAGE-002 — Attribution.** Recorded usage must be attributable to the owning user, Project, Job, and Attempt.
- **USAGE-003 — No charging.** Launch usage records must not create a balance, consume credits, require payment, or prevent execution based on billing state.

This page sets no numeric product-level guarantee for queue wait time, execution time, throughput, or availability. Future billing policy will decide which recorded usage is chargeable. Launch records facts only.

## Related docs

- [`vision.md`](./vision.md) — the product direction and launch boundary behind these requirements.
- [`roadmap.md`](./roadmap.md) — delivery sequence and concrete launch milestones.
- [`CONTEXT.md`](../../CONTEXT.md) — Taskome's canonical domain vocabulary.
- [`docs/README.md`](../README.md) — internal project documentation map.
