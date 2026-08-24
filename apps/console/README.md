# Taskome console

`apps/console` is the authenticated Taskome product application. It owns the
browser journeys for registration, sign-in, and the signed-in workspace. It
calls `apps/server` for authentication and domain behavior and is separate from
the public marketing site in `apps/web`.

The current implementation provides authentication flows and a dashboard
foundation. The product workflows described by the target architecture are not
implemented yet.

## Tech stack

| Technology                     | Role in the console                                                      |
| ------------------------------ | ------------------------------------------------------------------------ |
| React and TypeScript           | Product UI and type-safe application code                                |
| Vite                           | Local development server and production build                            |
| TanStack Router                | Type-safe file-based routing, loading, and navigation states             |
| TanStack Query                 | Server-state fetching and caching, including generated query hooks       |
| TanStack Form and Zod          | Form state and validation                                                |
| Better Auth                    | Browser authentication and session management                            |
| Orval                          | Fetch clients and TanStack Query hooks generated from the server OpenAPI |
| Tailwind CSS and `@taskome/ui` | Styling, design tokens, and shared UI primitives                         |

## Run the console locally

Complete the repository setup in [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
first. From the repository root, start the console together with its API and
local support services:

```bash
mise run dev
```

Open [http://localhost:3001](http://localhost:3001). You should reach the login
page when no Taskome session exists.

To run only the frontend after the server is available:

```bash
mise run //apps/console:dev
```

The setup task creates `apps/console/.env` from
[`apps/console/.env.example`](.env.example). `VITE_SERVER_URL` specifies the
control-plane server origin; local development uses `http://localhost:3000`.

## Understand the source layout

```text
src/
├── api/             # request adapter and generated application API client
├── components/      # console-specific UI compositions
├── lib/             # authentication and browser application helpers
├── routes/          # TanStack Router file routes and layouts
├── main.tsx         # query client and router composition
└── routeTree.gen.ts # generated route tree
```

## Work with routes and UI

TanStack Router generates `routeTree.gen.ts` from files under `src/routes`.
Treat the generated file as build output and make route changes in the route
source files.

Reusable primitives and global design tokens live in `packages/ui`. Import them
through public entry points such as `@taskome/ui/components/button`. Keep
console-specific pages and composed product components in this app.

## Use the server API

The console uses Orval to generate Fetch clients and TanStack Query hooks from
the server's OpenAPI contract. Generated code is split by OpenAPI tag under
`src/api/generated/`; do not edit these files manually.

Shared request behavior lives in `src/api/api-fetch.ts`. It resolves
`VITE_SERVER_URL`, includes browser credentials, and surfaces unsuccessful
responses to application code. Better Auth uses the separate client in
`src/lib/auth-client.ts` because its endpoints are not part of the application
OpenAPI contract.

After changing the server contract, regenerate the OpenAPI document and all
clients from the repository root:

```bash
mise run //:api:generate
```

Review and commit the generated changes with the contract change.
