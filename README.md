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

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/web/.env` file with your PostgreSQL connection details.

3. Start postgres, then apply the schema to your database:

```bash
mise run dev:up
pnpm run db:push
```

Then, run the development server:

```bash
mise run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the fullstack application.

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

- `compose.yml` — dev-support services only (postgres, SeaweedFS, a local otel-gui trace/log viewer). `web` and `gateway` run natively in development (`mise run dev`), not in containers.
- `compose.prod.yml` — overlay adding the containerized app stack (`web`, `gateway`) on top of `compose.yml`. App Dockerfiles live in `apps/*/Dockerfile`.
- `infra/` — shared infrastructure compose fragments (`include:`-d from one of the files above), plus placeholders for the eventual reverse proxy and GPU server provisioning. See `infra/README.md`.

Commands:

- Start dev-support services: `mise run dev:up`
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
| Local Compose      | `http://localhost:3000` | `http://web:3000`       | `http://localhost:8000`   | `http://gateway:8000`   |
| Production example | `https://example.com`   | `http://web:3000`       | `https://api.example.com` | `http://gateway:8000`   |

Web and Gateway must also share a dedicated `WEB_GATEWAY_HMAC_SECRET` of at
least 32 characters. Gateway uses it only to sign internal Personal API Key
verification requests to Web; keep it distinct from `BETTER_AUTH_SECRET` and do
not expose it to browsers or Direct API Clients.

For more details, see the guide on [Deploying with Docker Compose](https://www.better-t-stack.dev/docs/guides/docker).

## Git Hooks and Formatting

- Run checks (TS + Python, read-only): `mise run check`
- Lint everything with safe autofixes: `mise run lint`
- Format everything: `mise run format`

## Project Structure

```
taskome/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

`mise run <task>` is the primary entry point across the whole repo (TS + Python). `pnpm run <script>` still works underneath for TS-only scripts.

- `mise run dev`: Start all applications in development mode
- `mise run lint`: Lint the whole repo (TS + Python) with safe autofixes
- `mise run format`: Format the whole repo (TS + Python)
- `mise run check`: Read-only lint + format + type check across the whole repo
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
- `mise run dev:up`: Start dev-support services in the background (postgres, SeaweedFS, otel-gui)
- `mise run prod:build`: Build the production-shaped stack's images (web, gateway)
- `mise run prod:up`: Build and start the full production-shaped stack
- `mise run prod:logs`: Tail logs from the production-shaped stack
- `mise run prod:down`: Stop the production-shaped stack
