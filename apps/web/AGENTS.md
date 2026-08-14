<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Web responsibility

`apps/web` is one Next.js deployment with three deliberately distinct surfaces:

- `(public)` is XDenovo's external corporate website: a credible AI4Bio and de novo protein-design presence for researchers, partners, and the broader field.
- `(app)` is the authenticated internal Taskome platform: dashboards, account and API-key management, and user-facing API reference.
- The server-side Web layer is the browser's BFF for Gateway-owned data, while also owning Better Auth's Web authentication surface.

The company website may support brand, partnership, and commercial communication. The Taskome platform is still an internal multi-team tool: do not introduce billing, external-customer assumptions, or team-scoped visibility without an explicit product decision.

## Route boundaries

- Keep public corporate work in `(public)` independent from authenticated application flows and Gateway data. `references/old-website` is content and structural research only; never reuse it as runtime code.
- Keep product UI in `(app)`. It is an internal power-user interface: expose the curated, meaningful configuration surface of each Task rather than creating a no-code abstraction or an unbounded upstream-config passthrough.
- `(auth)`, `oauth/consent`, `security/two-factor`, and `two-factor` are security-sensitive authentication flows. Preserve redirect, session, consent, and recovery behavior when changing them.
- `apps/docs` is a separate static public documentation deployment, not another `apps/web` route group.
- No feature/domain component folders. Route-private components go in Next.js `_components/` at the nearest common ancestor route of everything that imports them. Cross-route shared components, and global singletons like `providers.tsx`, go flat in top-level `src/components/` — no domain subfolders there either.

## Gateway-backed data and BFF

- Before changing Gateway-backed reads, mutations, polling, client caching, or invalidation, read `../../docs/adr/0012-web-bff-gateway-data-ownership.md`. For the broader access-channel contract, read `../../docs/adr/0023-three-access-channels-and-public-gateway-api.md`.
- Browser code never calls Gateway or its generated client directly. Gateway-owned state enters the browser through this app's BFF Route Handlers when it must be fetched after hydration.
- Server Components read Gateway data and Server Actions perform Gateway mutations through the server-only generated `@taskome/api-client`; neither routes these calls through this app's Route Handlers.
- Introduce client-side server-state caching only for a concrete lifecycle such as polling, background refresh, shared cache, or optimistic updates. Its query functions call the Web BFF, not Gateway or a Server Action.
- Web owns authentication data only. Do not query Gateway-owned tables; cross-service access goes through Gateway's REST contract with the session JWT handled by the server-side client.

## Completion

- Public-site changes preserve an intentional external narrative and responsive, accessible behavior without pulling platform data or auth-only UI into the route.
- Authenticated-platform changes preserve the relevant authorization and route-group boundary, and cover behavior through the Web public seam defined in `../../docs/agents/testing.md`.
- BFF changes verify both the browser-facing response contract and the Gateway error/authentication behavior they shape.
