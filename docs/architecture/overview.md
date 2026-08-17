# Architecture overview

This page explains how Taskome is built and why — the handful of decisions that shape everything else. For what Taskome is and who it's for, see [`docs/product/vision.md`](../product/vision.md); this page picks up from there and stays on the "how."

Some of what's described below is target architecture rather than what's running today. Where that gap matters, you'll see a note like this:

> **Status note (delete once built):** describes what's still missing and why the note exists — remove the note itself once the gap closes, don't leave it as permanent commentary.

## Core principles

These are principles specific to how Taskome's architecture is shaped — not the general engineering principles in root `AGENTS.md` (today's-requirements, incremental delivery, and so on), which apply to how anyone writes code in this repo regardless of project. The principles below are about this system's shape specifically:

- **Every Task speaks REST and MCP equally.** Neither interface is a wrapper around the other — a Task Server exposes both from the same in-process core, so a human clicking through the Web App and an AI agent calling over MCP get the same behavior, not a degraded second-class path.
- **Every service owns its own data.** Web owns authentication data; Gateway owns everything else. Neither queries the other's tables directly — access always goes through an API.
- **Gateway is the one place identity gets decided.** Three different ways of connecting (browser session, MCP agent, API key) all resolve to the same internal notion of "who's asking" before anything downstream has to think about which channel a request came from.
- **A Task Server's compute logic and its infrastructure are separate ports.** What a Task actually computes (`ComputeAdapter`) and how it talks to the outside world — verifying a caller, resolving an input file, publishing an output (`TaskServerRuntime`) — are injected independently. Swapping one doesn't touch the other.

## Quality attributes

In priority order, because they sometimes trade off against each other and it's worth being explicit about which one wins:

1. **Maintainability and extensibility.** The team is small and the tool catalog is expected to keep growing (see vision.md's "opportunistic expansion" policy) — code that's hard to extend costs more every time a new tool ships. This is the top priority because it compounds: get it wrong once and every future addition gets more expensive.
2. **Security.** Even with today's semi-internal user base, the JWT/HMAC boundary between Web, Gateway, and Task Servers isn't a place to cut corners — a compromise here affects every Task Server behind Gateway at once, not just one feature.
3. **Correctness and traceability.** Vision.md commits to every Job's output being traceable to the exact tool version and parameters that produced it. For a platform whose whole job is running scientific compute, an output nobody can trust the provenance of isn't a useful output.
4. **Latency.** Deliberately lower priority: the compute tools themselves (GPU-bound protein design inference) dominate wall-clock time by orders of magnitude over anything Gateway's request handling could add or shave off.
5. **Availability.** Lowest priority for now, on purpose — vision.md's v1 scope is a small, known user base where a service hiccup has limited blast radius. This will move up the list if and when the user base grows past "people we know."

## Solution strategy

The big technical bets, grouped by concern. Each group links to the page that goes deeper.

### Task Server framework

Every compute tool (PepMimic-style binder design, pocket detection, whatever comes next) is wrapped the same way: a flat `apps/task-<name>` project, built on the shared `packages/task-kit` library via `build_task_server`. One Task Server can expose more than one Task, as long as they genuinely share the same compute dependencies, image, credentials, capacity, and deployment lifecycle — the project boundary tracks the compute environment, not a strict one-tool-per-project rule. Task authors implement one `ComputeAdapter` per Task; `task-kit` generates the matching REST route and MCP tool from it, and handles execution — both synchronous and asynchronous, so a Task author never has to pick one execution model up front — behind a separate `TaskServerRuntime` port for infrastructure concerns. This is what makes "every Task speaks REST and MCP equally" (above) actually hold — the wiring is generated once, in one library, not reimplemented per tool.

> **Status note (delete once built):** `task-kit` currently only implements synchronous execution, one worker per Task Server. Async support doesn't exist in code yet.

See [`docs/architecture/containers.md`](./containers.md) for where each Task Server sits, and [`docs/engineering/testing.md`](../engineering/testing.md) for how this shape gets tested.

### Gateway: the aggregation and identity boundary

Gateway is the single place a Web App, an MCP Agent, a Direct API Client, or the CLI connects to. It normalizes three different credential kinds — a Web session JWT, an audience-bound OAuth access token, and a Personal API Key — into one internal `Principal`, so nothing downstream has to branch on how the caller connected. The CLI uses REST-audience OAuth for interactive login and Personal API Keys for explicit automation, as defined in [ADR-0009](../adr/0009-cli-oauth-login-and-api-key-automation.md).

Gateway is also meant to aggregate every Task Server behind one MCP endpoint and one REST surface, and to own dispatching a Job to the right Task Server — through a separate Gateway Worker process that consumes a durable taskiq queue and brokers Ray resources (see [ADR-0008](../adr/0008-taskiq-ray-async-job-dispatch.md)), not by calling out directly from the request-handling process.

See [`docs/architecture/security.md`](./security.md) for the identity model in detail, and [`docs/architecture/runtime.md`](./runtime.md) for how a request is meant to flow once dispatch exists.

### Data ownership

One shared Postgres instance, split by schema per owner — Web's schema (Drizzle-managed) and Gateway's schema (Alembic-managed) never share tables, and cross-service access always goes through the owning service's API, never direct SQL. This is what keeps "every service owns its own data" (above) true in practice, not just in a diagram.

See [`docs/architecture/data.md`](./data.md).

### File storage

Large Input Files never pass through Next.js or an MCP agent's context window. Gateway mints short-lived, presigned SeaweedFS URLs; the client uploads or downloads directly against SeaweedFS. This keeps large binary payloads off Gateway's own request path entirely. Storage keys are ownership-agnostic by design, so the not-yet-built team/organization sharing model (vision.md's Future) doesn't require a storage migration when it lands.

See [`docs/architecture/data.md`](./data.md) and [`docs/architecture/integrations.md`](./integrations.md).

### Deployment

Everything runs on a single machine via Docker Compose today — a dev-support base (`compose.yml`) plus a production overlay (`compose.prod.yml`), with Caddy as the one public edge. Multi-node GPU scheduling (Ray, currently wired into the production Compose file but with no active consumer yet) is deferred until it's actually needed, not built ahead of time on spec.

See [`docs/architecture/deployment.md`](./deployment.md) and [`docs/architecture/constraints.md`](./constraints.md).

### Observability

Every service emits traces and structured logs over OpenTelemetry; production data lands in Axiom, local development gets a disposable self-hosted viewer. See [`docs/engineering/observability.md`](../engineering/observability.md) for the requirements this satisfies and how to use it day to day.

## Related docs

- [`docs/architecture/context.md`](./context.md) — the system boundary, as a diagram.
- [`docs/architecture/containers.md`](./containers.md) — how the pieces above relate, as a diagram.
- [`docs/architecture/constraints.md`](./constraints.md) — the limits this architecture is deliberately operating inside of.
- [`docs/architecture/risks.md`](./risks.md) — where this architecture is known to be thin.
- [`docs/adr/`](../adr/) — the specific decisions behind each strategy above.
