# Taskome console

`apps/console` is the authenticated Taskome product experience. It owns the
browser journeys for registration, sign-in, and the signed-in workspace. It
calls `apps/server` for authentication and domain behavior; it is separate from
the public marketing site in `apps/web`.

The current implementation provides authentication and dashboard foundations.
The complete Tool, Job, Project, file, Utility, and Agent Assistant journeys
remain target behavior rather than implemented features.

## Run the console locally

The shortest path starts the console together with its API and local support
services from the repository root:

```bash
mise run setup
mise run dev
```

Open [http://localhost:3001](http://localhost:3001). You should reach the login
page when no Taskome session exists.

To run only the frontend after the server is available:

```bash
mise run //apps/console:dev
```

The setup task creates `apps/console/.env` from `.env.example`. Set
`VITE_SERVER_URL` to the control-plane server origin; local development uses
`http://localhost:3000`.

## Work in the application

```text
src/
├── routes/          # TanStack Router file routes and layouts
├── components/      # console-specific compositions
├── lib/             # browser clients and application helpers
├── data/            # temporary local data used by the current foundation
├── main.tsx         # query client and router composition
└── routeTree.gen.ts # generated route tree
```

TanStack Router generates `routeTree.gen.ts` from files under `src/routes`.
Treat the generated file as build output and make route changes in the route
source files.

Reusable primitives and global design tokens live in `packages/ui`. Import
them through public entry points such as:

```tsx
import { Button } from "@taskome/ui/components/button";
```

Keep console-specific pages and composed product components in this app. A
component belongs in `packages/ui` only when more than one application should
consume the same primitive or behavior.

## Verify a change

```bash
mise run //apps/console:check
mise run //apps/console:build
```

The check task runs the configured linter and TypeScript compiler. The console
does not have an automated behavior test suite yet; add tests through a public
application seam when new behavior warrants one.

## Related documentation

- [`docs/architecture/containers.md`](../../docs/architecture/containers.md)
  defines the Web App container and distinguishes it from the marketing site.
- [`docs/engineering/coding-standards.md`](../../docs/engineering/coding-standards.md)
  defines repository-wide frontend and import boundaries.
- [`AGENTS.md`](AGENTS.md) contains console-specific instructions for AI agents.
