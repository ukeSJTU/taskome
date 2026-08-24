# XDenovo marketing site

`apps/web` is XDenovo's public marketing site. It introduces XDenovo and its
products and links visitors to Taskome registration and sign-in. It does not
share Taskome sessions, call Taskome domain APIs, or participate in scientific
data and compute lifecycles.

The current Next.js application is a minimal placeholder rather than a complete
marketing site.

## Run the site locally

Complete the repository setup in [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
first. Then start the site from the repository root:

```bash
mise run //apps/web:dev
```

Open [http://localhost:3002](http://localhost:3002). The development server
reloads changes under `src/app`.

## Work in the application

The site uses the Next.js App Router with React, TypeScript, and Tailwind CSS.
Routes, layouts, metadata, and page-local components belong under `src/app`.
Shared visual primitives and design tokens come from `@taskome/ui` through its
public exports.

Keep marketing content and presentation independent from the authenticated
product in `apps/console`. Links may send a visitor to Taskome, but this
application does not become a second Taskome frontend.
