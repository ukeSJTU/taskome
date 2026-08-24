# Contributing to Taskome

Use this guide to set up the repository, make and verify a change, and submit it
for review. Project-wide engineering standards live under
[`docs/engineering/`](docs/engineering), and application-specific instructions
live in each application's README.

## Before you begin

- Follow the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- Check existing GitHub issues before starting overlapping work. Align with the
  maintainers before making a large product or architecture change.
- Read the [`product vision`](docs/product/vision.md),
  [`domain vocabulary`](CONTEXT.md), and the README for the area you plan to
  change.

## Set up local development

Install [mise](https://mise.jdx.dev/) and Docker. From the repository root, run:

```bash
mise run setup
mise run doctor
```

The setup task installs the pinned toolchain and dependencies, creates missing
local environment files, and installs the Git hooks. A successful setup ends
with `mise run doctor` reporting no errors.

Use `mise run dev` to start the support services, server, and authenticated
console. See each application's README for its local URL and standalone run
command.

## Create a focused branch

Keep each branch limited to one coherent change. If you use Git worktrees, run
the repository task from your main checkout:

```bash
mise run //:worktree:create -- <type> <slug>
```

`<type>` must be `feat`, `fix`, or `chore`. The task creates the branch from the
latest `origin/main` under `.worktrees/<slug>`.

## Make the change

- Follow the [`coding standards`](docs/engineering/coding-standards.md).
- Add tests at the public seams defined in the
  [`testing guide`](docs/engineering/testing.md).
- Run `mise run //:api:generate` after changing the OpenAPI contract, and commit
  the regenerated TypeScript and Go clients with the contract change.
- Update documentation when behavior, setup, or an accepted design changes.
  Create architectural decision records from the
  [`ADR template`](docs/adr/template.md).
- Keep research notes under `docs/research/`. Git ignores this directory; do not
  commit its contents.

Run `mise tasks` to find workspace-specific commands instead of guessing a
package-manager command.

## Verify the change

Apply automatic formatting and safe lint fixes during development:

```bash
mise run format
mise run lint
```

Run focused tests while working, then run the complete repository gate before
opening a pull request:

```bash
mise run verify
```

`verify` runs static checks, service-free tests, race-enabled tests,
container-backed integration tests, and production builds. Docker must be
available. The pre-push Git hook runs the same gate automatically.

## Commit the change

Use [Conventional Commits](https://www.conventionalcommits.org/) messages:

```text
type(scope): concise description
```

Examples include `feat(server): add job endpoint`, `fix(console): preserve form
state`, and `docs: clarify local setup`. The commit hook formats staged files,
applies configured lint fixes, and scans for secrets. The commit-message hook
rejects messages that do not follow the convention.

## Open a pull request

Open the pull request against `main`. Keep its title compatible with
Conventional Commits and include:

- the problem and the chosen approach;
- the related issue, when one exists;
- the verification commands you ran;
- any API, schema, migration, dependency, or documentation changes reviewers
  should inspect closely.

Resolve review feedback with additional focused commits. Do not bypass failing
hooks or remove tests to make the branch pass.
