# Task-kit responsibility

`packages/task-kit` is Taskome's shared framework for building Task Servers — the flat `apps/task-<name>` projects that each group one or more Tasks sharing the same compute environment (dependencies, image, credentials, capacity, deployment lifecycle). It owns strict Params/Result validation, FastAPI/FastMCP exposure, signed Gateway-facing requests, Input File materialization, and output publication behind the `ComputeAdapter`/`TaskServerRuntime` port split (see `../../docs/architecture/overview.md`). It does not own Gateway-side dispatch, scheduling, or Job persistence — that's Gateway's responsibility.

## Invariants

- Group multiple Tasks into one Task Server only when they genuinely share compute dependencies, image, credentials, capacity, and deployment lifecycle. When they don't, split into separate `apps/task-<name>` projects instead of forcing a shared one.
- Task authors import only from the package root, `task_kit.runtime`, or `task_kit.testing`; every underscore-prefixed module is private and unsupported.
- Execution is synchronous today — one worker, one replica per Task Server, no durable queue, no cross-restart exactly-once guarantee. Async support is planned (`../../docs/product/vision.md`'s Execution section); until it lands, this is load-bearing, not a style preference — see `README.md`'s "Run and operations" for why.
- Never reuse a Task Server's Gateway HMAC secret or SeaweedFS credential across servers; each is scoped to that server's own storage prefix.
- A new Task Server's directory must be registered in root `mise.toml`'s `config_roots`, with its tasks added to the relevant root aggregate `depends` lists — config discovery doesn't do this automatically.

## Completion

- Cover adapter and app behavior through `task_kit.testing.fake_runtime()` at the REST/MCP seam; never import private runtime modules from a test.
- Run `mise run //packages/task-kit:check`, `:test:unit`, and `:test:integration` (the integration suite needs Docker) before calling a change done.
