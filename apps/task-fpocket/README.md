# task-fpocket

`task-fpocket` is Taskome's Task Server for binding pocket detection, wrapping the vendored [fpocket](https://github.com/Discngine/fpocket) tool (MIT license, pinned at tag `4.2.3` — see `compute/UPSTREAM.md` for exact provenance). It's built on [`packages/task-kit`](../../packages/task-kit/README.md); read that package's README and AGENTS.md first for how a Task Server works in general — this page only covers what's specific to this instance.

## Current state

This Task Server is a skeleton today. `pyproject.toml` depends on `task-kit`, but `src/fpocket_server/__init__.py` only has a placeholder entry point — there's no `ComputeAdapter`, no `build_task_server()` call, and no tests yet. [`docs/architecture/containers.md`](../../docs/architecture/containers.md) already flags this gap. This page will grow past a skeleton once that work lands.

## Running it (once built)

Once the `ComputeAdapter` and app assembly exist, run it the same way any `task-kit`-based Task Server runs:

```bash
mise run //apps/task-fpocket:sync
mise run //apps/task-fpocket:check
cd apps/task-fpocket && uv run fastapi dev src/fpocket_server/app.py
```

For today's placeholder, the only thing there is to run is the smoke-test entry point:

```bash
mise run //apps/task-fpocket:test
```

## Related docs

- [`packages/task-kit/README.md`](../../packages/task-kit/README.md), [`packages/task-kit/AGENTS.md`](../../packages/task-kit/AGENTS.md) — the framework this Task Server is built on.
- [`docs/architecture/containers.md`](../../docs/architecture/containers.md) — where this Task Server sits in the system.
- [`compute/UPSTREAM.md`](./compute/UPSTREAM.md) — vendoring provenance for the wrapped `fpocket` tool.
