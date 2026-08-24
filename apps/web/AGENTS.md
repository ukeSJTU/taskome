<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Taskome changes

Before adding authentication, product data, or shared UI, read the ownership
boundary in [`README.md`](README.md#work-in-the-application) and
[`docs/architecture/context.md`](../../docs/architecture/context.md). These
sources decide whether the change belongs in this app or `apps/console`.

Run `mise run //apps/web:check` for every change and
`mise run //apps/web:build` when routes, metadata, build configuration, or
production behavior changes.
