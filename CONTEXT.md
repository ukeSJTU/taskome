# taskome

Wraps bioinformatics compute tools (PepMimic, BindCraft, …) behind two interfaces, REST and MCP. Users reach those interfaces through three Access Channels: the Web App, an MCP Agent, or a Direct API Client. "taskome" = Task + -ome (the platform's full collection of Tasks).

## Language

**Task**:
A capability type registered in the platform (e.g. `pepmimic`, `bindcraft`). Declares an `executionMode` of `sync` or `async`. Analogous to a class.
_Avoid_: Model (reserve "model" strictly for the ML model weights a Task may use internally, never for the Task itself), Tool (MCP's own vocabulary for a callable primitive — a Task Server may expose a Task as one or more MCP tools, but "Task" is the platform-level concept). This avoidance is scoped to internal/engineering usage; user-facing product copy (docs site, marketing) may still call a Task a "tool" (e.g. "PepMimic, BindCraft, GraphPep" as the platform's tool set) since that's the vocabulary users already bring.

**Job**:
One invocation of a Task, created every time a Task is called — analogous to an instance of the Task class. A `sync` Task's Job is created and resolved to a terminal state (`ok`/`error`) within the same call. An `async` Task's Job starts `queued`/`running` and is polled until it reaches a terminal state.
_Avoid_: Run, Submission (use Job consistently).

**Task Server**:
Not a proxy in front of a compute service — it _is_ the compute service. One deployable process/container. The adapter layer we write (REST + MCP over one shared core) is always a single uv-managed Python project at the Task Server's root. The vendored upstream compute code lives alongside it in `compute/`, using whatever environment it actually needs (nothing extra, a system toolchain, or a separate conda environment when the tool depends on packages unavailable via PyPI, e.g. PepMimic) — resolved in the Dockerfile build, not by nesting Python projects. The adapter calls into the vendored code via subprocess, within the same container — never over the network. REST and MCP are both thin adapters over that same subprocess-backed core, not clients of each other.

_Vendored code_ means our own editable copy (free to modify or trim), not the read-only `references/*` submodules — those stay pinned for research only.

**Gateway**:
The front door service. Authenticates callers, routes/aggregates requests to Task Servers, and owns the `jobs` store as the single source of truth for Job state across both REST and MCP.

**Access Channel**:
One of the three user journeys into the platform: the Web App, an MCP Agent, or a Direct API Client. An Access Channel is not an interface: the Web App and Direct API Client both ultimately use REST, while the MCP Agent uses MCP.
_Avoid_: Interface (reserved here for REST or MCP), Authentication Method (a channel may involve more than one credential across its hops).

**Direct API Client**:
A user-controlled program, such as a script or `curl`, that calls the platform's REST interface without going through the Web App. It acts for a User; it is not an Agent and does not own Jobs or Input Files independently.
_Avoid_: Agent, Script Client, API User

**Personal API Key**:
A named, revocable credential through which a Direct API Client acts for the User who created it. It is not accepted through the MCP Access Channel and does not own Jobs or Input Files independently; the first version carries the User's full permissions, with narrower scopes deferred until concrete permission boundaries are designed.
_Avoid_: MCP Key, Service Account (a Personal API Key represents a User, not an independent identity)

**Input File**:
A user-supplied file (e.g. a PDB structure) uploaded independently of any Job and referenced by id across one or more Jobs. Ownership is tracked as a database record, never encoded in where it's stored; its bytes live under the gateway's own SeaweedFS prefix, separate from any Task Server's output storage. Immutable once uploaded — there is no re-upload-to-the-same-id operation, so a corrected file is always a new Input File with a new id. Deletable (soft delete: bytes removed, database record kept so Job history can still show it) but not yet garbage-collected automatically.
_Avoid_: Upload (names the action, not the persisted entity), Structure (too narrow — Input File also covers future non-structure input types), Asset (ambiguous with frontend build assets).
