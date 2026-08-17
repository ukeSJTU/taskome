---
status: accepted
date: 2026-08-17
decision-makers: Taskome maintainers
---

# Fake Adapter for Task compute, selected by one process-wide FAKE_MODE flag

## Context and Problem Statement

A Task Server's `ComputeAdapter` often depends on a real compute environment — a vendored binary, GPU, or model weights — that isn't available on every developer's machine or in every test run. Today only the infrastructure port has a supported fake (`task_kit.testing.fake_runtime()`); the compute port does not, so local MCP debugging and much of task-kit's own test suite still shell out to real tools. Separately, `apps/docs` will eventually want to let a visitor try a Task's REST endpoint without that turning into a real, billed, persisted Job. How should Taskome fake compute results, and how far should this change go toward that second, future goal?

## Decision Drivers

- Local MCP debugging and cheaper tests should not require GPU/vendored-binary/model-weight dependencies.
- Faked results must still be realistic enough to be useful for debugging, not empty/degenerate stubs.
- The public Params/Result JSON Schema — the same contract Gateway validates and publishes in OpenAPI — must not gain a debug-only field.
- Correctness and traceability (architecture overview.md's #3 quality attribute) means a fake result must never be mistakable for a real completed Job.
- Today's requirements only: `apps/docs` "try it" is a stated future goal, not something to build in this pass.

## Considered Options

- Auto-derive a fake from each Task's `result_model` Pydantic schema instead of requiring authors to hand-write one.
- A per-call fake flag (extra MCP tool argument / REST field) instead of a process-wide setting.
- A Fake Adapter that simulates the real algorithm well enough to vary its output with input `params`.
- Building the `apps/docs` "try it" flow in the same pass, including a way for Gateway to run a Task without creating a real Job.
- One fixed, process-wide `FAKE_MODE` setting, and a required hand-authored `fake_adapter` per Task that returns one realistic canned example regardless of input.

## Decision Outcome

Chosen option: "One fixed, process-wide `FAKE_MODE` setting, and a required hand-authored `fake_adapter` per Task that returns one realistic canned example regardless of input", because it is the smallest change that makes local debugging and testing tool-free, keeps the wire contract identical between real and fake runs, and leaves the harder try-it problem for a later, separately scoped decision instead of solving it by accident.

`TaskDefinition` gains a required `fake_adapter` field, of the same `ComputeAdapter[ParamsT, ResultT]` shape as `adapter`. `_validate_definition` rejects a `TaskDefinition` missing one, the same way it already rejects a missing description or an invalid Task name. A Fake Adapter ignores `params` (beyond ordinary type validation) and returns one fixed, realistic result — including any output files the real Task would produce, reusing existing test fixtures where possible (e.g. `apps/task-fpocket/tests/fixtures/1UYD.pdb`) rather than generating new ones. It is not a simplified simulator of the real algorithm.

`TaskServerSettings` gains `fake_mode: bool`, read from the env var `FAKE_MODE`, defaulting from `app_environment` the same way `docs_enabled` already does (`None` → derive from `Environment`, explicit value → override). When `fake_mode` is true, task-kit's runtime construction swaps in `fake_runtime()` (the existing infrastructure fake) alongside each Task's `fake_adapter`, so a local run needs no real Gateway HMAC secret or reachable SeaweedFS; the Gateway/SeaweedFS fields on `TaskServerSettings` become conditionally required rather than always-required to make that possible. The shared `compose.yml` dev stack pins `FAKE_MODE: false` explicitly, the same way `compose.prod.yml` already pins `APP_ENVIRONMENT: production`, so today's real-compute default for anyone using the shared stack does not silently change. Starting with `fake_mode=True` and `app_environment=PRODUCTION` together is a hard startup failure, not a warning.

Building `apps/docs`'s "try it" experience — which additionally requires not creating a real, persisted Job at all, a materially different problem from faking compute inside an otherwise-normal Job — is explicitly deferred to a future decision. This ADR's `FAKE_MODE` flag is the lever a future design is expected to pull, not the mechanism itself.

### Consequences

- Good, because local MCP debugging and most of task-kit's own tests no longer require the real fpocket binary, GPU, or model weights.
- Good, because the Params/Result JSON Schema is byte-for-byte identical whether a Task Server is running real or fake compute — no debug-only field ever reaches Gateway, OpenAPI, or an MCP client's tool schema.
- Good, because the production/fake-mode interlock makes "a real Job silently completed with fake results" a startup-time failure instead of a live incident.
- Bad, because every current and future Task author must write and maintain a second adapter, not just the real one.
- Bad, because a Fake Adapter that ignores `params` has limited value for debugging input-dependent behavior — it proves the plumbing and result shape, not the compute logic.
- Bad, because `TaskServerSettings`' Gateway/SeaweedFS fields move from unconditionally required to conditionally required, a small increase in that model's validation complexity.

### Confirmation

Review confirms: `build_task_server` raises when a `TaskDefinition` has no `fake_adapter`; a Task Server started with `FAKE_MODE=true` and no Gateway/SeaweedFS configuration serves its Tasks over both REST and MCP without any outbound network call; `compose.yml` pins `FAKE_MODE: false` for `task-fpocket`; and startup raises when `FAKE_MODE=true` is combined with `APP_ENVIRONMENT=production`.

## More Information

Reconsider this ADR when `apps/docs` "try it" is actually designed: that decision needs a way for Gateway (or something in front of it) to run a Task without `JobService.submit_job`'s durable create-and-enqueue, which this ADR deliberately does not solve.
