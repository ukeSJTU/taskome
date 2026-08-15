---
status: accepted
date: 2026-08-15
decision-makers: Taskome maintainers
---

# task-kit as a shared library, with compute logic and infrastructure split into separate ports

## Context and Problem Statement

Every compute tool Taskome wraps needs to expose the same shape — one or more Tasks, each reachable over both REST and MCP with equivalent behavior — and the catalog is expected to keep growing opportunistically (`vision.md`'s Tool scope). How should that wiring be built so adding a new tool is cheap, REST and MCP genuinely stay in lockstep, and a Task author's code isn't tangled up with infrastructure concerns like signed requests, file resolution, and output publication?

## Decision Drivers

- "Every Task speaks REST and MCP equally" (`overview.md`'s Core principles) — reimplementing this per tool risks the two surfaces drifting apart.
- Maintainability and extensibility is the top-ranked quality attribute (`overview.md`) — the team is small and the catalog grows opportunistically, so the cost of adding a tool matters more than almost anything else.
- Task authors should write compute logic, not auth, storage, or transport plumbing.
- Execution model shouldn't be a decision every Task author makes independently — both synchronous and asynchronous execution need to be supported without a Task author having to pick one up front.

## Considered Options

- Each Task Server independently implements its own REST and MCP wiring
- A shared library (`task-kit`) that generates REST/MCP wiring from one compute definition, with infrastructure concerns behind a separate port
- A code generator or scaffolding tool that copies boilerplate into each new Task Server

## Decision Outcome

Chosen option: "A shared library (`task-kit`) that generates REST/MCP wiring from one compute definition, with infrastructure concerns behind a separate port", because it's the only option where the REST/MCP wiring is written once and infrastructure concerns can change without touching every Task Server's code.

A Task author implements one `ComputeAdapter` per Task — a curated Params/Result model plus the actual compute call. `task-kit`'s `build_task_server` generates the matching REST route and MCP tool from it. Infrastructure concerns (verifying the caller, resolving an Input File, publishing an output) live behind a separate `TaskServerRuntime` port, injected independently — swapping one doesn't touch the other. Every Task Server is a flat `apps/task-<name>` uv project (not a nested `server/` package, not a root workspace member), and can group more than one Task as long as they genuinely share compute dependencies, image, credentials, capacity, and deployment lifecycle — the project boundary tracks the compute environment, not a strict one-tool-per-project rule.

### Consequences

- Good, because REST/MCP wiring is written once, in one library, instead of being reimplemented — and potentially drifting — per tool.
- Good, because the `ComputeAdapter`/`TaskServerRuntime` split means infrastructure changes (for example, adding async execution, or changing the storage backend) don't require touching Task authors' code.
- Good, because grouping Tasks by shared compute environment, rather than one-tool-per-project, avoids an explosion of near-identical deployables for tools that genuinely belong together.
- Bad, because every Task Server now depends on `task-kit` staying stable — a breaking change to its public API affects every Task Server at once, not just one.
- Bad, because today's implementation only supports synchronous execution, even though both sync and async are the intended Now design — see `docs/architecture/overview.md`'s status note on this gap.

### Confirmation

Every Task Server's `app.py` should contain only settings, runtime, Task definitions, and the `build_task_server` call — no direct FastAPI/FastMCP instantiation, routes, or middleware. Task authors should only import from `task_kit`'s package root, `task_kit.runtime`, or `task_kit.testing`; anything importing an underscore-prefixed module is a violation.

## Pros and Cons of the Options

### Each Task Server implements its own wiring

- Good, because each Task Server has full control and no shared-dependency risk.
- Bad, because REST and MCP wiring would be reimplemented per tool, with no structural guarantee they stay equivalent — directly undermining "every Task speaks REST and MCP equally."
- Bad, because every infrastructure improvement (auth, storage, observability) would need to be ported to every Task Server by hand.

### Shared library with a compute/infrastructure port split (chosen)

- Good, because the wiring and infrastructure concerns are centralized and reusable.
- Good, because the port split means infrastructure can evolve (sync to async, one storage backend to another) without Task author code changing.
- Neutral, because it introduces a shared dependency every Task Server must track.

### Code generator or scaffolding tool

Generate a new Task Server's boilerplate once from a template, then let it diverge.

- Good, because it doesn't create a shared runtime dependency.
- Bad, because generated boilerplate drifts from the template the moment it's edited — a classic cookiecutter problem — so REST/MCP equivalence and infrastructure improvements can't be guaranteed or centrally rolled out.

## More Information

See [`packages/task-kit/README.md`](../../packages/task-kit/README.md) for the concrete API, [`packages/task-kit/AGENTS.md`](../../packages/task-kit/AGENTS.md) for the contract Task authors and this library must hold to, and [`docs/architecture/containers.md`](../architecture/containers.md) for where Task Servers sit in the system. Revisit the port split if a Task ever needs infrastructure behavior `TaskServerRuntime` can't express — that would be a signal the port boundary is drawn in the wrong place, not a reason to bypass it.
