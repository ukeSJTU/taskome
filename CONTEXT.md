# taskome

Wraps bioinformatics compute tools (PepMimic, BindCraft, …) and exposes them two ways: MCP for AI agents, REST for the web app. "taskome" = Task + -ome (the platform's full collection of Tasks).

## Language

**Task**:
A capability type registered in the platform (e.g. `pepmimic`, `bindcraft`). Declares an `executionMode` of `sync` or `async`. Analogous to a class.
_Avoid_: Model (reserve "model" strictly for the ML model weights a Task may use internally, never for the Task itself), Tool (MCP's own vocabulary for a callable primitive — a Task Server may expose a Task as one or more MCP tools, but "Task" is the platform-level concept).

**Job**:
One invocation of a Task, created every time a Task is called — analogous to an instance of the Task class. A `sync` Task's Job is created and resolved to a terminal state (`ok`/`error`) within the same call. An `async` Task's Job starts `queued`/`running` and is polled until it reaches a terminal state.
_Avoid_: Run, Submission (use Job consistently).

**Task Server**:
Not a proxy in front of a compute service — it _is_ the compute service. One deployable process/container holding two separate Python environments: a conda environment running the vendored upstream compute code (e.g. PepMimic, BindCraft) as-is, and a uv-managed environment running the thin adapter layer we write (REST + MCP). The adapter calls into the vendored code via subprocess, within the same container — never over the network. REST and MCP are both thin adapters over that same subprocess-backed core, not clients of each other.

_Vendored code_ means our own editable copy (free to modify or trim), not the read-only `references/*` submodules — those stay pinned for research only.

**Gateway**:
The front door service. Authenticates both callers (web app on behalf of a logged-in user, external Agents via OAuth), routes/aggregates requests to Task Servers, and owns the `jobs` store as the single source of truth for Job state across both REST and MCP.
