---
status: accepted
---

# `packages/ui` consumption: source-only (no build step), theme tokens only for `apps/docs`

`packages/ui` (`@taskome/ui`) is consumed as raw `.tsx`/`.ts` source via `workspace:*` — its `package.json` `exports` map straight to `./src/**`, there is no `build` script and no `dist/`. Next.js resolves the linked workspace package directly, the same way it resolves any first-party source. We're keeping it that way rather than introducing a bundler (`tsup` or similar) and publish step: neither current consumer (`apps/web`, `apps/docs`) needs `packages/ui` outside this monorepo, and a build step buys nothing but an extra artifact to keep in sync until a real external consumer shows up.

`apps/docs` imports only `@taskome/ui/theme.css` (the CSS-variable token layer), layered under its own `fumadocs-ui/css/shadcn.css` + `preset.css`. It does not import any component from `@taskome/ui/components/*`, including the plain primitive wrappers (Button, Card, Input, etc.) — even though nothing technically prevents it, since Base UI and Radix (Fumadocs' primitive layer) can coexist in one app without conflicting. We're drawing the line at theme tokens only, to keep `apps/docs` free of a second component-primitive runtime and avoid the two apps' component trees ever needing to interoperate. This matches the research conclusion in #23: `packages/ui` (Base UI) and `fumadocs-ui` (Radix) are compatible at the theme-token layer but not at the component layer.

Tailwind/PostCSS config is not centralized: `apps/web` and `apps/docs` each keep their own near-identical `postcss.config.mjs`. Tailwind v4 is CSS-first (no `tailwind.config.js/ts` to share), and the one line of PostCSS plugin wiring duplicated across two files isn't worth a `packages/config` preset.

`packages/ui/src/components/` currently mixes generic Base UI primitive wrappers (Button, Input, Card, ...) with product-specific composed components (`sidebar.tsx`'s app-shell, `chart.tsx`, and a chat/AI-assistant cluster — `message.tsx`, `bubble.tsx`, `marker.tsx`, `attachment.tsx`) that only `apps/web`'s authenticated app actually uses. We're leaving this mix ungoverned: the directory is shadcn CLI's install target (`apps/web/components.json` points there), and re-sorting its contents by "generic vs. product-specific" is a shadcn-tooling concern, not a consumption-boundary one.

## Consequences

- `apps/docs/AGENTS.md`'s guidance to "use `@taskome/ui` for shared presentation primitives" no longer matches this decision and is updated alongside this ADR to say `apps/docs` shares `@taskome/ui`'s theme only.
- If a real external consumer of `packages/ui` ever appears, this ADR's no-build-step call should be revisited rather than assumed to still hold.
