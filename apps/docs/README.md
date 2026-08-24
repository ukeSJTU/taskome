# Taskome documentation site

`apps/docs` is the public documentation site for people who use Taskome. It is
a Next.js application backed by Fumadocs and MDX. It is separate from the
internal product, architecture, and engineering documents under the repository
[`docs/`](../../docs/README.md) directory.

The current site still contains starter content. Treat pages under
`content/docs` as placeholders until product-facing guides and reference pages
replace them.

## Run the site locally

From the repository root:

```bash
mise run setup
mise run //apps/docs:dev
```

Open [http://localhost:4000](http://localhost:4000), then visit
[http://localhost:4000/docs](http://localhost:4000/docs) to render the MDX
documentation collection.

## Write public documentation

Author public pages under `content/docs`. Each MDX page supplies frontmatter
for at least its title and description:

```mdx
---
title: Submit a job
description: Configure and submit a Taskome Tool from the web app.
---
```

Use the public documentation for user journeys, supported product behavior,
and external reference material. Keep internal design rationale, target
architecture, engineering conventions, and planning documents under the root
`docs/` directory.

The application routes include:

| Route                              | Purpose                               |
| ---------------------------------- | ------------------------------------- |
| `/`                                | Documentation landing page            |
| `/docs`                            | Fumadocs page collection              |
| `/api/search`                      | Documentation search index            |
| `/llms.txt` and `/llms-full.txt`   | Text views for language-model clients |
| `/llms.mdx/docs/<slug>/content.md` | Processed Markdown for one page       |

Fumadocs source configuration lives in `src/lib/source.ts`. Layout and route
code belongs under `src/app`; reusable MDX rendering components belong in
`src/components/mdx.tsx`.

## Verify a change

```bash
mise run //apps/docs:check
mise run //apps/docs:build
```

The production build is the strongest local verification for MDX imports,
generated routes, and page rendering.

## Related documentation

- The repository [`docs/README.md`](../../docs/README.md) routes internal
  product and engineering documentation.
- [`docs/product/vision.md`](../../docs/product/vision.md) defines the launch
  boundary that public documentation must represent accurately.
- [`AGENTS.md`](AGENTS.md) contains generated Next.js instructions for AI agents.
