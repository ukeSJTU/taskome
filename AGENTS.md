# AGENTS.md

## Project direction

Internal platform for XDenovo's own binder/de novo protein design work — not an external product, no billing. Modeled after two references, each contributing a different piece:

- [tamarind.bio](https://app.tamarind.bio/app) — GPU-backed compute tools behind one platform, reachable from a web UI.
- [subseq.bio](https://subseq.bio/) — power-user posture: expose a tool's real configuration surface rather than tamarind's no-code abstraction.

Initial tool set: PepMimic, BindCraft, GraphPep — extend opportunistically as useful tools appear, no fixed catalog boundary.

- **Users**: multiple internal teams share one instance. Accounts are flat and individual for now — no team-scoped sharing/visibility yet; that's a later feature, not a storage-layer concern (ADR-0011's ownership-agnostic storage keys already support it whenever it lands).
- **Interfaces**: MCP and REST are both required for every Task — neither ships alone as "done." Users reach them through four Access Channels: the Web App uses REST through its BFF, MCP Agents use MCP directly, Direct API Clients use REST directly, and the CLI also uses REST directly. See ADR-0023 for the three channels that predate the CLI addition.
- **Parameters**: each Task's MCP/REST parameters are a curated subset of the underlying tool's real config, not a full passthrough — designed per tool, including vendored-code changes where needed to expose what's worth exposing.
- **Job chaining** (piping one Job's output into the next Job's input): out of scope for now, on the roadmap — design it when it's picked up, don't build around its absence.

### Public website

`apps/web` also serves as XDenovo's public corporate website (the `(public)` route group), independent of the authenticated tool platform above. XDenovo operates in the AI4Bio field (AI-native biotech / de novo protein design); the website communicates that positioning outward and is not part of the internal tool platform's product surface. `references/old-website` (the previous site) is kept as content/structure reference only, never reused as code. See ADR-0018 for the rebuild approach.

## Architecture

- **Components**: `apps/web` (Next.js) is the only browser application for the authenticated product — there is no separate frontend/backend split. Its own API routes are the BFF: they aggregate calls to `apps/gateway` (FastAPI + MCP) into responses shaped for the frontend. Browser code never bypasses that BFF; the separately deployed Gateway exposes MCP to Agents and the curated `/v1` REST contract to non-browser Direct API Clients. `apps/docs` is static public content with no Gateway access. See ADR-0020 and ADR-0023.
- **Data ownership**: each service reads and writes only the Postgres data it owns — `apps/web` owns auth, `apps/gateway` owns everything else (jobs, input files, …). Cross-service access always goes through gateway's REST API, never direct SQL against the other's tables. One shared Postgres instance, split by schema per owner; migrations stay per-owner too (`packages/db`/Drizzle for web, SQLAlchemy/Alembic for gateway).
- **Web → gateway calls**: server-side only (never the browser), authenticated with a better-auth-minted JWT, through the generated client in `packages/api-client` (orval, from gateway's checked-in OpenAPI spec). See ADR-0012 for the full reasoning.

## AI development

Each AI owns one task at a time.

- **Worktrees:** Before changing repository files, use the `using-git-worktrees` skill to select the direct-edit exception or prepare an isolated worktree.
- **Tests:** When designing or writing tests, use the `tdd` skill so tests exercise behavior through agreed public seams. See `docs/agents/testing.md` for this repo's seam definitions, directory conventions, and fixture strategy for `apps/web` and `apps/gateway`.
- **Review:** Before opening a feature PR, use the `code-review` skill to review the diff against project standards and its specification.
- **Conflicts:** When an in-progress merge or rebase has conflicts, use the `resolving-merge-conflicts` skill to resolve them by intent.
- **Commits:** Write Conventional Commits messages (`type(scope?): subject`); the `commit-msg` hook enforces them with commitlint.

## Engineering principles

- **Today's requirements:** Implement the least complex solution that satisfies today's requirements. Avoid abstractions, configuration, and indirection intended for hypothetical future needs.

- **Incremental delivery:** Begin with the smallest end-to-end version that works, then add capabilities without sacrificing a functioning product for unfinished complexity.

- **Module boundaries:** Keep modules independent, with clear responsibility boundaries.

- **Existing capabilities first:** Before writing custom code or installing another package, investigate what the project's existing dependencies already provide. Check their documentation and types first.

- **Mature dependencies:** Use mature, actively maintained libraries when they improve reliability or reduce total complexity. Avoid rebuilding standard functionality without a strong reason.

- **Prior art:** Before designing a solution, examine how established products address the same problem and reuse proven patterns and conventions.

- **Durable architecture:** Make architectural choices that remain sound over time. Keep roadmap-staged backends behind stable boundaries, and avoid temporary solutions that leak into product contracts.

- **Cleanup:** Remove outdated code paths instead of maintaining old behavior through compatibility shims, fallbacks, or migrations.

- **Licensing:** Treat third-party licensing as a release gate owned by Legal and Compliance, not as a reason to avoid the best-fit tool during development. Use only licenses or evaluation access currently authorized for the development context, record the dependency, and require Legal and Compliance approval before production use, external access, redistribution, or commercial release.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (ukeSJTU/taskome), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
