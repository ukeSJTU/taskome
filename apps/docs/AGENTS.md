# Docs responsibility

`apps/docs` is the static public documentation site. It presents deliberately public information and has no Gateway access or dependency on internal platform data.

## Invariants

- Keep internal operational details, credentials, private endpoints, and team-specific workflows out of published content unless their publication is explicitly part of the task.
- Share `@taskome/ui`'s theme tokens only (`@taskome/ui/theme.css`, layered under Fumadocs' own shadcn preset) — don't import `@taskome/ui` components. See ADR-0025.

## Completion

- Verify changed content renders through the site's build/type-check path and that navigation and links still resolve.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
