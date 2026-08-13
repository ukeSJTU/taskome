---
status: accepted
---

# Task Server layout is always one flat uv project; compute's isolation need is a Dockerfile concern

ADR-0001 modeled every Task Server as two sibling directories — `compute/` (conda) and `server/` (uv, holding its own `pyproject.toml`) — because PepMimic/BindCraft's vendored ML code needs conda specifically. Building the first real Task Server (`apps/task-fpocket`, wrapping the compiled-C `fpocket` binary) exposed the flaw: `fpocket`'s `compute/` has no Python dependencies at all, so nesting an adapter-only `server/` subdirectory just to hold a `pyproject.toml` added a directory level with no purpose. ADR-0001 conflated two separate concerns — "does compute need its own isolated environment" and "where does the adapter's `pyproject.toml` live" — that aren't actually coupled: environment isolation is handled entirely by the Dockerfile's build stages, not by source-tree nesting.

We checked this isn't just true for the easy case: `references/pepmimic/env_cu124.yaml` depends on `salilab::dssp`, `anaconda::libboost`, and `bioconda::mmseqs2` — packages with no PyPI equivalent — plus a CUDA-matched `pytorch-cuda` build that needs conda's resolver. Conda genuinely is required there, but requiring it doesn't require nesting the adapter code under `server/`.

Every `apps/task-<name>/` is a single flat uv-managed Python project — `pyproject.toml` and `src/<name>_server/` always live at the Task Server's root, never nested under a `server/` subdirectory. `compute/` is always a plain subdirectory holding whatever the vendored tool needs: nothing beyond its source (if invoked as a pre-built system binary), a `Makefile` (compiled tools like fpocket, built via a system-toolchain Dockerfile stage), or its own `environment.yml` (conda-dependent tools like PepMimic, built via a conda Dockerfile stage). The Dockerfile's multi-stage build is where compute's actual environment need gets resolved; the directory shape doesn't change based on it.

What still stands from ADR-0001: no shared interpreter between compute and adapter (bridged via subprocess within the same container); `apps/task-<name>/` placement (independently deployable, not a `packages/` library); vendored code under `compute/` is our own editable copy, distinct from the read-only `references/*` submodules kept for research only; the adapter package name is `<name>-server`, never `<name>-mcp`; the Task Server's `mise.toml` is registered in the root `mise.toml`'s `[monorepo].config_roots` but its `pyproject.toml` is not a root `[tool.uv.workspace]` member.

## Consequences

- `mise.toml`'s `build` task and the Dockerfile's stage list differ per Task Server (a no-op for pure-binary tools, `make` for compiled tools, `conda env create` for ML tools) — that variance now lives entirely in build tooling, not in how the source tree is organized.
