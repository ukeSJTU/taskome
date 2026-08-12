---
name: using-git-worktrees
description: Prepare and retire isolated Taskome development worktrees. Use before changing repository files to choose the direct-edit exception or create a feature worktree, when entering an existing worktree that needs setup and baseline verification, and after an integrated branch is ready for local cleanup.
---

# Using Git Worktrees

Keep each task in one checkout. Inspect freely before deciding, then perform every task write, setup command, test, and commit in the selected checkout.

## 1. Select the checkout

Resolve the current repository state before changing files:

```bash
git rev-parse --show-toplevel
git rev-parse --path-format=absolute --git-dir
git rev-parse --path-format=absolute --git-common-dir
git rev-parse --show-superproject-working-tree
git branch --show-current
git status --short
```

Treat differing Git and common directories as an existing linked worktree only when `--show-superproject-working-tree` is empty; a submodule is not a task worktree.

Use the current main checkout only for either of these direct-edit cases:

- A single-purpose, low-risk change touching at most three source or configuration files, with no dependency change or database migration.
- A single-topic documentation-only change, regardless of file count.

Before taking the exception, compare the intended target files with the existing diff. Preserve unrelated changes. If an existing change overlaps a target or the task depends on uncommitted work, report the concrete dependency and wait for direction.

Use the current linked worktree when it belongs to this task. If it contains changes, establish from its branch, log, and diff that they belong to the task; preserve them. Stop when ownership is unclear.

## 2. Create isolation when required

Infer `feat`, `fix`, or `chore` from the task and choose a lowercase kebab-case slug. From the main checkout, run:

```bash
mise run //:worktree:create -- <type> <slug>
cd .worktrees/<slug>
```

The project task owns the branch name, location, remote-main fetch, and creation checks. Use it as the exclusive creation interface.

## 3. Prepare and verify

In a newly created or clean existing worktree, run:

```bash
mise run setup
mise run check
mise run test
```

Treat successful checks in a clean checkout as the baseline. If setup or the baseline fails, report the failing command and output, then wait for a decision before implementing.

In an existing worktree with task changes, run the same commands but report their outcome as current verification, never as a clean baseline.

Keep submodules uninitialized in feature worktrees. Treat the initialized `references/` checkouts under the main checkout as read-only research sources. Stop and plan separately when a task changes a submodule gitlink or submodule content.

## 4. Retire integrated work

Retire a worktree only after its work is integrated and its working tree is clean. Leave the worktree in place while a PR is open.

From the main checkout, run:

```bash
mise run //:worktree:remove -- <type> <slug>
```

The project task verifies integration against `origin/main` or a merged GitHub PR for the exact local branch head before removing the worktree and local branch. It refuses initialized submodules and ambiguous integration state. Resolve the reported condition through the project workflow.
