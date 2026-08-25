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

The marketing site links to the other public applications through explicit
origins. The local defaults match the repository development ports. Copy
`.env.example` to `.env.local` only when you need to override them:

| Variable                 | Local default           | Purpose                         |
| ------------------------ | ----------------------- | ------------------------------- |
| `XDENOVO_WEB_ORIGIN`     | `http://localhost:3002` | Canonical marketing-site origin |
| `TASKOME_CONSOLE_ORIGIN` | `http://localhost:3001` | Taskome sign-in destination     |
| `TASKOME_DOCS_ORIGIN`    | `http://localhost:4000` | Taskome documentation origin    |

Set all three variables to their public HTTPS origins in the production build
environment. Do not include a path; the site adds stable destinations such as
Console `/login` itself.

## Work in the application

The site uses the Next.js App Router with React, TypeScript, and Tailwind CSS.
Routes, layouts, metadata, and page-local components belong under `src/app`.
Shared visual primitives and design tokens come from `@taskome/ui` through its
public exports.

Keep marketing content and presentation independent from the authenticated
product in `apps/console`. Links may send a visitor to Taskome, but this
application does not become a second Taskome frontend.

## Preserve the locale-ready SEO boundary

The current site publishes one canonical English document at `/`. It includes
English metadata, Open Graph output, `robots.txt`, a sitemap, and Organization
plus SoftwareApplication structured data.

Do not add `hreflang` entries or localized sitemap URLs until the corresponding
pages exist. The planned first locale paths are `/en/...` and `/zh-cn/...`.
When those routes ship, each locale must own translated metadata, a
self-referencing canonical URL, reciprocal alternate-language links, and its
own sitemap entry. Reusable visual primitives must continue to accept copy as
content instead of embedding English strings.
