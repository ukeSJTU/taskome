# XDenovo marketing site

`apps/web` is XDenovo's public marketing site. It introduces XDenovo and its
products and links visitors to Taskome registration and sign-in. It does not
share Taskome sessions, call Taskome domain APIs, or participate in scientific
data and compute lifecycles.

The current Next.js application is a minimal placeholder rather than a complete
marketing site.

## Run the site locally

Install the repository dependencies, then start this application from the
repository root:

```bash
mise run setup
mise run //apps/web:dev
```

Open [http://localhost:3002](http://localhost:3002). The development server
reloads changes under `src/app`.

## Work in the application

The site uses the Next.js App Router. Routes, layouts, metadata, and page-local
components belong under `src/app`; shared visual primitives come from
`@taskome/ui` through its public exports.

Keep marketing content and presentation independent from the authenticated
product in `apps/console`. Links may send a visitor to Taskome, but this
application does not become a second Taskome frontend.

## Verify a change

```bash
mise run //apps/web:check
mise run //apps/web:build
```

The check task runs the configured linter and TypeScript compiler. The build
task also verifies the production Next.js application.

## Related documentation

- [`docs/architecture/context.md`](../../docs/architecture/context.md) defines
  the marketing site as a system outside Taskome.
- [`docs/architecture/containers.md`](../../docs/architecture/containers.md)
  maps Taskome's authenticated Web App to `apps/console`.
- [`AGENTS.md`](AGENTS.md) contains generated Next.js instructions for AI agents.
