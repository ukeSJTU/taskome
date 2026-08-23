# taskome

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **Node.js** - Runtime environment
- **Go CLI** - Cobra-based command-line interface
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)

## Getting Started

Install the pinned toolchain and dependencies:

```bash
mise run setup
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

Start local PostgreSQL, create the server environment file, and apply committed
migrations:

```bash
cp apps/server/.env.example apps/server/.env
mise run dev:up
mise run //apps/server:db:migrate
```

When the Better Auth configuration or plugins change, regenerate and review the schema migration before applying it:

```bash
pnpm --dir apps/server auth:generate
mise run //apps/server:db:generate
mise run //apps/server:db:migrate
```

Then, run the development server:

```bash
mise run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the console application.
The web application is running at [http://localhost:3002](http://localhost:3002).
The documentation application is running at [http://localhost:4000](http://localhost:4000).
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json`, `apps/console/components.json`, and `apps/web/components.json`

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

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from the target application in `apps/console` or `apps/web`.

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Project Structure

```
taskome/
├── apps/
│   ├── cli/         # Go command-line interface
│   ├── console/     # User console (React + TanStack Router)
│   ├── docs/        # Documentation application (Next.js + Fumadocs)
│   ├── web/         # Web application (Next.js)
│   └── server/      # Backend API, authentication, and database (Hono)
├── packages/
│   ├── env/         # Shared environment schemas
│   └── ui/          # Shared shadcn/ui components and styles
```

## Available Scripts

- `mise run dev`: Start the server and console
- `mise run build`: Build all deliverable applications
- `mise run check`: Run read-only repository checks
- `mise run test`: Run service-free test suites
- `mise run test:integration`: Run container-backed integration suites
- `mise run dev:up | dev:down | dev:logs`: Manage local PostgreSQL
- `mise run //apps/server:db:generate | db:migrate | db:studio`: Manage the server schema

See [`apps/server/README.md`](apps/server/README.md) for the server's feature
layout, HTTP conventions, and test seams.
