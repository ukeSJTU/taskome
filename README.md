# taskome

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)

## Getting Started

Initialize the locked dependencies, local environment files, and Git hooks:

```bash
mise run setup
```

`setup` creates missing `apps/web/.env` and `apps/gateway/.env` with generated
local secrets, without printing or overwriting them. If both files already
exist, their `WEB_GATEWAY_HMAC_SECRET` values must be non-placeholder and
identical. Review either file before continuing; the root `.env` is optional and
only overrides Compose defaults from [`.env.example`](.env.example).

Start the supporting services, apply the Gateway schema, then run all three
native applications:

```bash
mise run dev:up
mise run gateway:db:migrate
mise run dev
```

Web runs at [localhost:3000](http://localhost:3000), Gateway at
[localhost:8000](http://localhost:8000), and Docs at
[localhost:3001](http://localhost:3001).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@taskome/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment

### Docker Compose

Two files, not one — see [ADR-0013](docs/adr/0013-dev-support-base-and-prod-overlay-compose.md):

- `compose.yml` — dev-support services only (PostgreSQL, Redis, SeaweedFS, and a local otel-gui trace/log viewer). Web, Gateway, and Docs run natively in development (`mise run dev`), not in containers.
- `compose.prod.yml` — overlay adding the three deployables (`web`, `docs`, and one `gateway`) plus Caddy on top of `compose.yml`. App Dockerfiles live in `apps/*/Dockerfile`.
- `infra/` — shared infrastructure compose fragments (`include:`-d from one of the files above), plus placeholders for the eventual reverse proxy and GPU server provisioning. See `infra/README.md`.

Commands:

- Start dev-support services: `mise run dev:up`
- Stop dev-support services: `mise run dev:down`
- Tail dev-support logs: `mise run dev:logs`
- Build prod images: `mise run prod:build`
- Start the full prod-shaped stack: `mise run prod:up`
- Logs: `mise run prod:logs`
- Stop: `mise run prod:down`

Environment variables are read from each app's `.env` file (baked into web builds for public variables) and overridden in the compose files for container networking.

Public identity and internal reachability use four canonical origins. Native
development and the production-shaped local Compose rehearsal keep public origins
on localhost; Compose uses service names only for internal hops. A real deployment
uses the documented example hosts:

| Environment        | `BETTER_AUTH_URL`       | `WEB_INTERNAL_URL`      | `GATEWAY_PUBLIC_URL`      | `GATEWAY_INTERNAL_URL`  |
| ------------------ | ----------------------- | ----------------------- | ------------------------- | ----------------------- |
| Native local       | `http://localhost:3000` | `http://localhost:3000` | `http://localhost:8000`   | `http://localhost:8000` |
| Local Compose      | `http://localhost`      | `http://web:3000`       | `http://api.localhost`    | `http://gateway:8000`   |
| Production example | `https://example.com`   | `http://web:3000`       | `https://api.example.com` | `http://gateway:8000`   |

Web and Gateway must also share a dedicated `WEB_GATEWAY_HMAC_SECRET` of at
least 32 characters. Gateway uses it only to sign internal Personal API Key
verification requests to Web; keep it distinct from `BETTER_AUTH_SECRET` and do
not expose it to browsers or Direct API Clients.

For a real deployment, copy [`.env.production.example`](.env.production.example)
to `.env`, replace both secret placeholders, populate the app-specific `.env`
files, and point the three hostnames at the machine. Caddy is the only public
application edge. It routes `example.com` to Web and `docs.example.com` to Docs;
`api.example.com` exposes only `/v1`, `/mcp`, and
`/.well-known/oauth-protected-resource/mcp`. Gateway development, health, auth,
and internal paths are deliberately not routed. See
[`infra/proxy/README.md`](infra/proxy/README.md) for the exact matrix.

For more details, see the guide on [Deploying with Docker Compose](https://www.better-t-stack.dev/docs/guides/docker).

## Git Hooks and Formatting

- Run checks (TS + Python, read-only): `mise run check`
- Lint everything with safe autofixes: `mise run lint`
- Format everything: `mise run format`

## Project Structure

```
taskome/
├── apps/
│   ├── web/         # Fullstack application (Next.js)
│   ├── docs/        # Public documentation (Next.js/Fumadocs)
│   └── gateway/     # REST + MCP backend (FastAPI/FastMCP)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

`mise run <task>` is the repository's primary command surface. Application and
package `pnpm` scripts remain implementation details; root `package.json` does
not proxy repository workflows.

- `mise run setup`, `mise run env:init`: prepare dependencies, hooks, and local configuration
- `mise run dev`, `mise run web:dev`, `mise run gateway:dev`, `mise run docs:dev`: start all or one native application
- `mise run dev:up`, `mise run dev:down`, `mise run dev:logs`: manage local support services
- `mise run build`: build Web and Docs
- `mise run lint`, `mise run format`, `mise run check`, `mise run test`: repository-wide quality tasks
- `mise run web:db:push|generate|migrate|studio`: operate on the Web-owned Drizzle schema
- `mise run gateway:db:migrate|revision`: operate on the Gateway-owned Alembic schema
- `mise run api-client:generate`, `mise run api-client:verify`: update or verify generated Gateway client code
- `mise run deps:outdated`: report Node, Python, GitHub Action, and mise tool updates without changing lockfiles
- `mise run prod:build|up|down|logs`: operate on the production-shaped Compose stack
