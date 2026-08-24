# Taskome documentation site

`apps/docs` is the public documentation site for people who use Taskome. It is
a Next.js application backed by Fumadocs and MDX. Internal product,
architecture, and engineering documents live separately under the repository
[`docs/`](../../docs/README.md) directory.

The current site still contains starter content. Treat pages under
`content/docs` as placeholders until product-facing guides and reference pages
replace them.

## Run the site locally

Complete the repository setup in [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
first. Then start the site from the repository root:

```bash
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
title: Sign in to Taskome
description: Access the authenticated Taskome console.
---
```

Use the public documentation for user journeys, supported product behavior,
and external reference material. Keep internal design rationale, target
architecture, engineering conventions, and planning documents under the root
`docs/` directory.

## Understand the site structure

- `content/docs/` contains the public MDX collection.
- `src/lib/source.ts` configures the Fumadocs source and processed Markdown.
- `src/components/mdx.tsx` defines reusable MDX rendering components.
- `src/app/` contains the documentation layouts, routes, search endpoint, and
  text views for language-model clients.

Fumadocs renders the collection under `/docs` and derives search and
language-model-friendly views from the same source pages.
