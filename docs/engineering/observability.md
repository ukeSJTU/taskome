# Observability

This page defines how Taskome writes and correlates operational signals —
structured logs today; tracing and metrics once they're adopted — across the
Control Plane Server, the Execution Service, and Tool Runtimes. It doesn't
cover what to do when something goes wrong; that's
[`architecture/runbooks.md`](../architecture/runbooks.md)'s job once it's
written. It also doesn't repeat what already has a home elsewhere:
[`architecture/security.md`](../architecture/security.md) owns exactly what an
Observability Backend may and may not receive, and
[`architecture/containers.md`](../architecture/containers.md) owns which
containers exist and how they connect.

> **Target architecture, not shipped code.** No container in the repository
> emits structured logs yet. This page describes the accepted design they must
> follow once built.

## Write structured logs, not ad hoc output

Every Taskome process writes structured JSON log lines to its own stdout — no
`console.log`, no bare `print`, no unstructured text. Which library produces
that JSON differs by language:

- TypeScript processes (the Control Plane Server, the Execution Service) use
  [`evlog`](https://www.evlog.dev/) — chosen for its "wide events" pattern
  (one complete, context-rich log line per operation instead of many
  disconnected ones) and its built-in structured-error fields, which fit
  `runtime_toolkit`'s error-classification responsibility (see
  [`architecture/components/tool-runtime.md`](../architecture/components/tool-runtime.md))
  better than a conventional line-by-line logger would.
- Python processes (every `runtimes/*` Tool Runtime) use
  [`structlog`](https://www.structlog.org/), the established
  structured-logging library for Python.

Every log line carries the same minimum fields regardless of language or
library: a timestamp, a level, a message, the emitting service's name, and the
relevant correlation field(s) below. This is a field convention, not a wire
format — it doesn't require OpenTelemetry's semantic conventions, because
Taskome hasn't adopted OpenTelemetry yet (see
[Defer distributed tracing, metrics, and a backend](#defer-distributed-tracing-metrics-and-a-backend)
below).

## Correlate a request, then correlate an Attempt

Two different correlation keys answer two different questions, and Taskome
keeps them distinct rather than collapsing them into one:

| Correlation key            | Answers                                                                        | Scope                                                                                                 | Where it's defined                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request correlation ID** | Which log lines belong to this one request or operation?                       | One inbound call — a REST or MCP request, a CLI invocation                                            | Already defined by [`security.md`](../architecture/security.md)'s durable security events; this page reuses that field rather than inventing a second one. |
| **Attempt ID**             | Which log lines belong to this one Attempt, across every container it touches? | One Attempt's full lifecycle — submission, every status check against it, execution, and finalization | Defined on this page.                                                                                                                                      |

An Attempt outlives any single request: a user submits it in one request,
polls its status in several more, and it executes across the Execution
Service, a Kubernetes Job, and a Tool Runtime without any request being open
at all. A request correlation ID can't express that continuity — it dies with
the request. The Attempt ID is what ties the whole thing together:

- The Control Plane Server assigns the Attempt ID at Job acceptance and
  includes it on every log line about that Attempt from then on.
- The Execution Service already uses the Attempt ID as the Temporal Workflow
  ID (see [`runtime.md`](../architecture/runtime.md)), so every Activity
  invocation already has it in scope — it only needs to actually appear in
  the log line.
- The Kubernetes Job name is already derived from the Attempt ID (see
  [`runtime.md`](../architecture/runtime.md)), but a Tool Runtime container
  can't reliably parse its own Job name back out, so the Attempt ID is also
  passed to it directly as an environment variable, for its `structlog`
  output to include as a field.

A single log line can carry both fields at once — for example, the request
that first submits an Attempt has both a request correlation ID (this one
request) and the newly assigned Attempt ID (everything that follows).

## Know which containers emit signals, and where they stop

[`containers.md`](../architecture/containers.md)'s diagram already settles
which containers have a path to the Observability Backend: only the Control
Plane Server, the Execution Service, and Tool Runtimes do. The Web App and CLI
don't emit anything of their own — their behavior only shows up in the
Control Plane Server's logs for the requests they make.

| Container            | Emits                                        | Correlation fields available                              |
| -------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Control Plane Server | Structured logs for every request it handles | Request correlation ID always; Attempt ID once one exists |
| Execution Service    | Structured logs for every Activity it runs   | Attempt ID always (it's the Workflow ID)                  |
| Tool Runtime         | Structured logs for its single run           | Attempt ID always (passed in as an environment variable)  |
| Web App, CLI         | Nothing directly                             | —                                                         |

[`security.md`](../architecture/security.md) already states exactly what an
Observability Backend may and may not receive — this page doesn't repeat that
list, but every field named above must satisfy it.

## Defer distributed tracing, metrics, and a backend

This page deliberately does not adopt:

- **OpenTelemetry**, or any distributed-tracing system — without it, there's
  no span linking a request across containers, only the shared correlation
  fields above. Adopting OpenTelemetry later doesn't invalidate those fields;
  it adds trace and span IDs alongside them.
- **Metrics** — [`architecture/risks.md`](../architecture/risks.md) already
  notes that Taskome has no numeric availability or scaling targets yet. A
  metrics design without a target to measure against would be speculative.
- **An Observability Backend product** (Axiom, a self-hosted Grafana stack, or
  otherwise) — [`architecture/integrations.md`](../architecture/integrations.md)
  already tracks this as an open choice.
- **A local development log viewer** — without a chosen backend or
  OpenTelemetry, there's nothing for a local viewer like `otel-gui` to
  connect to.

All four are deliberately deferred, not rejected — see
[Resolve implementation decisions in the owning section](#resolve-implementation-decisions-in-the-owning-section)
below.

## Run without a chosen backend in local development

A developer reads structured logs the same way they'd read any process's
stdout: `docker logs`, `kubectl logs`, or the terminal a process runs in
directly. This works today because every process already writes structured
JSON to stdout regardless of what, if anything, collects it later —
collection is a deployment concern, not something an application process
needs to know about. Adopting a backend later only changes what reads that
stdout; it doesn't change what a process writes to it.

## Trade-offs and design choices

- **Structured logging now, tracing and metrics later.** Committing to
  `evlog` and `structlog` doesn't block adopting OpenTelemetry later — trace
  and span IDs would sit alongside the correlation fields defined here, not
  replace them. The cost of deferring is that today, correlating logs from
  one Attempt means filtering by the Attempt ID rather than following a trace
  visually.
- **Two correlation keys instead of one.** A single ID could arguably serve
  both purposes, but doing so would either force every incidental request (a
  status check) to carry an Attempt-shaped identity it doesn't have, or force
  the Attempt ID to be reissued per request and lose its cross-container
  continuity. Keeping them distinct costs one extra field on some log lines;
  collapsing them would cost the ability to answer either question cleanly.

## Resolve implementation decisions in the owning section

### Choose whether and when to adopt OpenTelemetry

Whether Taskome adopts OpenTelemetry for distributed tracing, and when, is
open. If adopted, it extends this page's correlation model rather than
replacing it.

### Choose the Observability Backend product

Already tracked as open in
[`integrations.md`](../architecture/integrations.md) — Axiom, a self-hosted
Grafana stack, or another product.

### Choose a local development log viewer

Once a backend (and, if adopted, OpenTelemetry) is chosen, local development
needs its own way to view the same shape of data without production
credentials. Not yet decided.

### Define the metrics design

Deferred until [`requirements.md`](../product/requirements.md) or a later
decision sets a numeric availability or scaling target to measure against.

## Related docs

- [`architecture/security.md`](../architecture/security.md) — the request
  correlation ID this page reuses, and exactly what data an Observability
  Backend may and may not receive.
- [`architecture/containers.md`](../architecture/containers.md) — the
  container diagram this page's emitter table is drawn from.
- [`architecture/runtime.md`](../architecture/runtime.md) — where the Attempt
  ID becomes the Temporal Workflow ID and the Kubernetes Job name.
- [`architecture/integrations.md`](../architecture/integrations.md) — the
  Observability Backend as an external system, and its failure-handling
  rules.
- [`architecture/components/tool-runtime.md`](../architecture/components/tool-runtime.md) —
  `runtime_toolkit`'s structured-logging and error-classification
  responsibility.
- [`architecture/risks.md`](../architecture/risks.md) — why no numeric target
  exists yet for a metrics design to measure against.
