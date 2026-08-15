# fpocket Task Server responsibility

`apps/task-fpocket` is a Task Server built on `packages/task-kit`, wrapping the vendored `fpocket` tool in `compute/`. It owns one or more `ComputeAdapter`s exposed through Taskome's shared REST/MCP contract — today, just binding-pocket detection, but nothing here limits it to one Task if a future Task shares `fpocket`'s compute environment. It does not own Gateway dispatch, authentication, or Job persistence — see `../../packages/task-kit/AGENTS.md` for what task-kit already handles.

## Invariants

- This is a flat uv project — not a nested `server/` package, not a root workspace member — with its own lockfile and a relative editable dependency on `task-kit`.
- `compute/` is a vendored snapshot of upstream `fpocket` (see `compute/UPSTREAM.md`), not a Git submodule — editable in place, but record any local modification there before making it. Never copy or edit `references/` material as this server's compute source.
- Keep `compute/` excluded from first-party Python lint/type checks; it's vendored, not authored here.
- Follow `../../packages/task-kit/AGENTS.md`'s Task-author invariants (root-only imports, error classification, output path rules) — this app doesn't redefine them.

## Completion

- Cover each `ComputeAdapter` through `task_kit.testing.fake_runtime()` at the REST/MCP seam, using the real wrapped `fpocket` binary where practical.
- Run `mise run //apps/task-fpocket:check` and `:test` before calling a change done.
