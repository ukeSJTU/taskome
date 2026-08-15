# task-fpocket

`task-fpocket` is Taskome's Task Server for binding pocket detection, wrapping the vendored [fpocket](https://github.com/Discngine/fpocket) tool (MIT license, pinned at tag `4.2.3` — see `compute/UPSTREAM.md` for exact provenance). It's built on [`packages/task-kit`](../../packages/task-kit/README.md); read that package's README and AGENTS.md first for how a Task Server works in general — this page only covers what's specific to this instance.

## What it does

One Task, `detect_pockets`: given a protein structure (PDB format), it runs fpocket's Voronoi-tessellation pocket detection and returns:

- `value.pocket_count` and `value.pockets` — a curated per-pocket subset (`rank`, `score`, `druggability_score`, `volume`, `num_alpha_spheres`), parsed from fpocket's `_info.txt`. A structure with no detectable pockets is a successful result with `pocket_count: 0`, not an error.
- One output file, `annotated_structure` — the input structure annotated with pocket alpha-sphere centers (fpocket's `_out.pdb`), self-contained enough to visualize pockets without any other file.

Params: `structure` (required) plus three optional algorithm parameters that control detection sensitivity — `min_alpha_size` (default `3.4`), `max_alpha_size` (default `6.2`), `min_spheres_per_pocket` (default `15`) — fpocket's own compiled-in defaults. Everything else fpocket supports (clustering method, chain filtering, explicit-pocket/ligand mode, experimental energy grids, mmCIF input, ...) is deliberately not exposed in v1; see `packages/task-kit/README.md`'s guidance against raw CLI passthrough.

## Scope

This Task Server is reachable directly over REST/MCP and is covered end to end by tests using the real fpocket binary. What it does **not** include: Gateway's queue → Ray → dispatch path (ADR-0004) — nothing calls this Task Server yet, matching `docs/architecture/containers.md`'s current status. That's separate, larger work.

## Running it

**Tests** (builds the native binary for the host platform first, then runs against it):

```bash
mise run //apps/task-fpocket:sync
mise run //apps/task-fpocket:check
mise run //apps/task-fpocket:test
```

**Locally via Docker Compose** (dev-only; not yet wired into `compose.prod.yml` since nothing dispatches to it in production):

```bash
docker compose up -d task-fpocket
curl http://127.0.0.1:18000/health/ready
```

The compose service points at the real dev SeaweedFS so output publication genuinely round-trips, not just returns a 200 with a fake path. `GATEWAY_INTERNAL_URL`/`GATEWAY_TASK_HMAC_SECRET` are placeholders — nothing calls out to Gateway yet, but a request must still be signed with the configured secret to reach `/internal/*` routes.

**Manual verification against the running container** — HMAC-signing a request by hand isn't practical with plain `curl`, so use the helper script:

```bash
./scripts/sign-internal-request.py \
  --secret taskome-local-fpocket-gateway-hmac-secret \
  --method GET --target /internal/manifest --execute
```

See the script's own docstring (`--help`) for the `detect_pockets` POST example and its caveats (it needs a real Gateway-resolvable Input File id to fully succeed; against this compose stack alone, expect a 502 `input_materialization_failed`, which is the correct behavior with no live Gateway).

**Outside Docker**, run the same way any `task-kit`-based Task Server runs, after building the native binary and pointing `FPOCKET_BINARY` at it (see `.env.example`):

```bash
uv run fastapi dev src/fpocket_server/app.py
uv run fastapi run --workers 1 src/fpocket_server/app.py
```

## Related docs

- [`packages/task-kit/README.md`](../../packages/task-kit/README.md), [`packages/task-kit/AGENTS.md`](../../packages/task-kit/AGENTS.md) — the framework this Task Server is built on.
- [`docs/architecture/containers.md`](../../docs/architecture/containers.md) — where this Task Server sits in the system.
- [`compute/UPSTREAM.md`](./compute/UPSTREAM.md) — vendoring provenance for the wrapped `fpocket` tool.
