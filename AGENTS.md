# AGENTS.md

## Project direction

Taskome is XDenovo's product for running binder and de novo protein design compute — see [`docs/product/vision.md`](docs/product/vision.md) for what it is, who it's for, and the Now/Future scope boundary.

## AI development

Each AI owns one task at a time.

- **Worktrees:** Before changing repository files, use the `using-git-worktrees` skill to select the direct-edit exception or prepare an isolated worktree.
- **Tests:** When designing or writing tests, use the `tdd` skill so tests exercise behavior through agreed public seams. See `docs/engineering/testing.md` for this repo's seam definitions, directory conventions, and fixture strategy for `apps/web` and `apps/server`.
- **Review:** Before opening a feature PR, use the `code-review` skill to review the diff against project standards and its specification.
- **Conflicts:** When an in-progress merge or rebase has conflicts, use the `resolving-merge-conflicts` skill to resolve them by intent.
- **Commits:** Write Conventional Commits messages (`type(scope?): subject`); the `commit-msg` hook enforces them with commitlint.
- **Docs:** When writing documents, if the document is intended to be read by humans, follow the guidance in `writing-web-documentation`; if the document is intended to be read by ai agents, follow the guidance in `writing-for-agents`.

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues for `ukeSJTU/taskome`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five default canonical labels. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses the single-context layout. See `docs/agents/domain.md`.

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
