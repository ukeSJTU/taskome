<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Taskome documentation changes

Before choosing where content belongs or changing the site structure, read
[`README.md`](README.md#write-public-documentation) and the repository
[`docs/README.md`](../../docs/README.md). They define the public/internal
documentation boundary and the owning source locations.

Run `mise run //apps/docs:check` for every change and
`mise run //apps/docs:build` when MDX content, routes, source configuration, or
production behavior changes.
