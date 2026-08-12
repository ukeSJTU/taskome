# AGENTS.md

## Project direction

做一个类似 [tamarind.bio](https://app.tamarind.bio/app) 和 [subseq.bio](https://subseq.bio/) 这样的网站

## Parallel AI development

Each AI owns one task at a time. Use a dedicated Git worktree for feature work so
parallel tasks never edit or commit from the same checkout.

- Before making changes, decide whether the task qualifies for the direct-edit
  exception below. Otherwise, create and work only in a feature worktree.
- Branches use `<type>/<feature-slug>` and worktrees use
  `.worktrees/<feature-slug>` at the workspace root. Use lowercase kebab-case
  slugs. Valid types include `feat`, `fix`, and `chore`.
- Create a feature worktree from the current remote `main` branch with:

    ```bash
    mise run //:worktree:create -- feat <feature-slug>
    ```

    The task validates the type and slug, fetches `origin/main`, and refuses to
    overwrite an existing branch or worktree. Then change into that worktree
    before reading, modifying, testing, or committing task files. Do not make
    feature changes in the main checkout.

- Direct edits in the main checkout are allowed only for a single-purpose,
  low-risk change touching at most three source or configuration files, with no
  dependency change or database migration. Single-topic documentation-only
  changes may also be made there regardless of file count.
- After the feature is merged and its worktree is clean, remove the worktree
  and delete its local branch:

    ```bash
    mise run //:worktree:remove -- feat <feature-slug>
    ```

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

- **Commit messages:** Follow Conventional Commits (`type(scope?): subject`), enforced by the `commit-msg` git hook via commitlint.
