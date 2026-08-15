# Roadmap

Milestones toward `vision.md`'s Now bar — not a day-to-day task tracker. For the policy behind why tools get added opportunistically instead of against a fixed list, see [`vision.md`](./vision.md)'s Tool scope; this page is the concrete roster and sequencing that policy deliberately keeps out of vision.md.

## Tool roster

| Tool                                                          | Status                                                                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `task-fpocket` (binding pocket detection, wrapping `fpocket`) | In progress — the app skeleton exists, but it doesn't call `build_task_server()` yet (see `docs/architecture/containers.md`).                                                        |
| PepMimic, BindCraft, BioMCP, Galaxy/Galaxy MCP, pdb-tools     | Researched, not committed. Reference material lives under `references/`. Per the opportunistic-expansion policy, appearing here isn't a promise — it's what's been looked at so far. |

## Milestones

Sequenced by getting one tool fully working before adding the next, and within that, by which Access Channel needs the least additional plumbing first.

1. **`task-fpocket` end to end, via MCP and Direct API Client.** Gateway gets a real Job/Task data model and the dispatch path from [ADR-0004](../adr/0004-gateway-owned-job-dispatch.md) (taskiq queue → Ray resource request → synchronous dispatch); `task-fpocket` actually calls `build_task_server()`. MCP Agents and Direct API Clients ship together here because both reach Gateway directly — no Web BFF work is needed for either.
2. **Web App channel.** Web's BFF surfaces Job submission and status for `task-fpocket`, reusing the dispatch path milestone 1 built.
3. **CLI channel.** A new CLI tool is built against the same REST-plus-Personal-API-Key path a Direct API Client already uses — no new Gateway-side work, just a new client.
4. **Additional tools.** Once milestones 1 through 3 land, adding a new tool mostly means writing its `ComputeAdapter` — `task-kit` already generates REST and MCP together for it, and all four Access Channels already reach Gateway.

## Related docs

- [`docs/product/vision.md`](./vision.md) — the Now/Future policy this roadmap sequences.
- [`docs/architecture/containers.md`](../architecture/containers.md) — the current implementation gaps each milestone closes.
- [`docs/adr/0004-gateway-owned-job-dispatch.md`](../adr/0004-gateway-owned-job-dispatch.md) — the dispatch design milestone 1 builds.
