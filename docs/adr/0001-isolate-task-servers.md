---
status: superseded by ADR-0015 (directory shape only — no `server/` subdirectory, `compute/`'s conda need is per-tool and resolved in the Dockerfile; subprocess bridging within one container, `apps/` placement, vendored-code-is-editable, `<name>-server` naming, and non-membership in the root uv workspace all still stand)
---

# Isolate each Task Server in its own environment

Each Task Server is its own process/container with two separate Python environments inside, bridged by subprocess rather than sharing an interpreter:

- **conda**, running the vendored upstream compute code (PepMimic, BindCraft, …) as-is. These tools pin conflicting CUDA/PyRosetta/native-binary versions that can't coexist with each other, let alone with the rest of the monorepo's toolchain.
- **uv**, running the thin adapter layer we write ourselves: a FastAPI + fastmcp process (REST + MCP, serving sync Tasks directly and status lookups) and a separate Taskiq worker process (consuming async Job dispatches — see ADR-0005). Neither has native-dependency constraints — this is normal PyPI-only Python — so it gets the same uv-based toolchain as the gateway, just in its own environment, not the root uv workspace (a Task Server's required Python version may not match the root's).

Each Task Server lives at `apps/task-<name>/` (e.g. `apps/task-pepmimic/`), alongside `apps/web` and `apps/gateway` — it's an independently deployable service like they are, not a shared library, so it belongs under `apps/`, not `packages/`. Inside, `compute/` holds the vendored upstream code (conda) and `server/` holds our adapter layer (uv-managed, package name `<name>-server`, e.g. `pepmimic-server` — never `<name>-mcp`, since it hosts both the REST and MCP adapters, not MCP alone). Neither Task Server's uv-managed `pyproject.toml` is added to the root `[tool.uv.workspace].members`, though its `mise.toml` _is_ added to the root `mise.toml`'s `[monorepo].config_roots` (that only wires up task discovery for `mise run check`, not dependency resolution) — so root-level `uv sync` never touches it, but `mise run check` still aggregates its lint/format/type checks.
