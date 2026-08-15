# taskome

Wraps bioinformatics compute tools (PepMimic, BindCraft, …) behind two interfaces, REST and MCP. Users reach those interfaces through four Access Channels: the Web App, an MCP Agent, a Direct API Client, or the CLI. "taskome" = Task + -ome (the platform's full collection of Tasks).

## Language

**Task**:
A curated compute capability registered in the platform (e.g. `fpocket_detect`, `bindcraft_design`). A Task has a name unique within its Task Server; Gateway qualifies it with the Task Server name for platform-wide discovery. Analogous to a class.
_Avoid_: Model (reserve "model" strictly for the ML model weights a Task may use internally, never for the Task itself), Tool (MCP's own vocabulary for a callable primitive — a Task Server may expose a Task as one or more MCP tools, but "Task" is the platform-level concept). This avoidance is scoped to internal/engineering usage; user-facing product copy (docs site, marketing) may still call a Task a "tool" (e.g. "PepMimic, BindCraft, GraphPep" as the platform's tool set) since that's the vocabulary users already bring.

**Job**:
Exactly one invocation of one Task with one complete Params object — analogous to an instance of the Task class. A Params object may contain multiple files when they jointly form one logical input, and a Job may produce multiple outputs; processing independent inputs is multiple Jobs, never one platform-level batch invocation. The first implementation is synchronous and resolves the Job to `ok` or `error` within the same Gateway call; asynchronous execution is deferred.
_Avoid_: Run, Submission (use Job consistently).

**Task Server**:
Not a proxy in front of a compute service — it _is_ the compute service. One deployable process/container may expose multiple Tasks that share one compute environment; each Task's name is unique only within that server. The REST + MCP adapter is one flat uv-managed Python project, with task-kit generating both transports over one shared execution core. Vendored upstream code lives alongside it in `compute/` and is invoked in-process or by subprocess within the same container, never as a separate network service.

_Vendored code_ means our own editable copy (free to modify or trim), not the read-only `references/*` submodules — those stay pinned for research only.

**Gateway**:
The front door service. Authenticates callers, routes/aggregates requests to Task Servers, and owns the `jobs` store as the single source of truth for Job state across both REST and MCP.

**Principal**:
The immutable, transport-neutral identity produced after Gateway authenticates a credential. Contains the canonical User id, the credential kind, and an optional non-secret credential id. REST dependencies, MCP tools, ownership checks, and structured logs consume the Principal rather than parsing credentials or claims independently.

**Access Channel**:
One of the four user journeys into the platform: the Web App, an MCP Agent, a Direct API Client, or the CLI. An Access Channel is not an interface, and not a credential kind: the Web App and Direct API Client both ultimately use REST, while the MCP Agent uses MCP, and the CLI shares Direct API Client's Personal API Key relationship rather than getting a distinct credential kind of its own (see [ADR-0002](docs/adr/0002-identity-and-access-channels.md)). What makes the CLI its own channel despite reusing that credential and interface is who builds and ships the client — Taskome does, the same as the Web App — not which wire protocol or credential it uses.
_Avoid_: Interface (reserved here for REST or MCP), Authentication Method (a channel may involve more than one credential across its hops), collapsing "credential kind" and "Access Channel" onto the same axis — there are four channels but only three credential kinds.

**Direct API Client**:
A user-controlled program, such as a script or `curl`, that calls the platform's REST interface without going through the Web App. It acts for a User; it is not an Agent and does not own Jobs or Input Files independently.
_Avoid_: Agent, Script Client, API User

**CLI**:
Taskome's own command-line entry point, built and shipped by Taskome, unlike a Direct API Client which a user brings on their own. It authenticates through the same Personal API Key relationship a Direct API Client already uses, so it needed no new Gateway-side identity or dispatch work — just a new client (see [ADR-0002](docs/adr/0002-identity-and-access-channels.md)).
_Avoid_: treating the CLI as a subset of Direct API Client — they're distinct Access Channels distinguished by who builds and ships the client, not by which credential or interface it uses.

**Personal API Key**:
A named, revocable credential through which a Direct API Client acts for the User who created it. It is not accepted through the MCP Access Channel and does not own Jobs or Input Files independently; the first version carries the User's full permissions, with narrower scopes deferred until concrete permission boundaries are designed.
_Avoid_: MCP Key, Service Account (a Personal API Key represents a User, not an independent identity)

**Input File**:
A user-supplied file (e.g. a PDB structure) uploaded independently of any Job and referenced by id across one or more Jobs. Ownership is tracked as a database record, never encoded in where it's stored; its bytes live under the gateway's own SeaweedFS prefix, separate from any Task Server's output storage. Immutable once uploaded — there is no re-upload-to-the-same-id operation, so a corrected file is always a new Input File with a new id. Deletable (soft delete: bytes removed, database record kept so Job history can still show it) but not yet garbage-collected automatically.
_Avoid_: Upload (names the action, not the persisted entity), Structure (too narrow — Input File also covers future non-structure input types), Asset (ambiguous with frontend build assets).
