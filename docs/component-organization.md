# Component organization

How to decide where a component file lives, for any Next.js app in this monorepo (`apps/web` today, `apps/docs` as it grows). Not an ADR — this is a team convention, easy to revise, not a one-way door.

## Rule

1. **No feature/domain folders.** Don't group components by business domain (`auth/`, `dashboard/`, `marketing/`). It adds a layer of decision-making ("which domain is this?") that route structure already answers for free.
2. **Route-private components go in `_components/`**, using Next.js's [Private Folders](https://nextjs.org/docs/app/getting-started/project-structure#private-folders) convention (an underscore-prefixed folder is excluded from routing). Place it at the _nearest common ancestor_ route segment of everything that imports it — not one `_components/` per leaf route, and not hoisted higher than needed.
3. **Cross-route shared components go in the app's top-level `src/components/`**, kept flat (no domain subfolders). Admission test: is this used by ≥2 route subtrees that aren't siblings sharing a single ancestor's `_components/`? If yes, it belongs at the top level. If everything currently in `src/components/` turns out to be route-private, the directory should end up nearly empty — that's the rule working, not a gap.
4. Global, non-route-specific singletons (e.g. a root `providers.tsx` mounted once in the root layout) also live in the top-level `src/components/`, even though they're not "shared across routes" in the reuse sense — they just don't belong to any single route subtree either.

## `apps/web` target structure

Applying the rule to `apps/web`'s current components (all of which turned out to be route-private to exactly one route group):

```
apps/web/src/
├── app/
│   ├── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── _components/
│   │       ├── login-form.tsx
│   │       └── signup-form.tsx
│   ├── (app)/
│   │   ├── account/api-keys/page.tsx
│   │   ├── api-docs/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── _components/
│   │       ├── app-sidebar.tsx
│   │       ├── nav-main.tsx
│   │       ├── nav-user.tsx
│   │       ├── nav-secondary.tsx
│   │       ├── nav-documents.tsx
│   │       ├── site-header.tsx
│   │       ├── data-table.tsx
│   │       ├── section-cards.tsx
│   │       ├── api-keys-panel.tsx
│   │       ├── api-reference-panel.tsx
│   │       ├── chart-area-interactive.tsx
│   │       ├── header.tsx
│   │       ├── mode-toggle.tsx
│   │       ├── theme-provider.tsx
│   │       └── user-menu.tsx
│   ├── (public)/
│   │   ├── page.tsx
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── legal/page.tsx
│   │   ├── platform-cases/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── products/page.tsx
│   │   ├── technology/page.tsx
│   │   └── _components/   # was components/public/*, "public" prefix dropped — the directory is the namespace now
│   │       ├── hero-section.tsx
│   │       ├── mission-section.tsx
│   │       ├── pipeline-section.tsx
│   │       ├── products-section.tsx
│   │       ├── team-section.tsx
│   │       ├── validation-section.tsx
│   │       ├── about-mission-section.tsx
│   │       ├── about-team-section.tsx
│   │       ├── about-timeline-section.tsx
│   │       ├── binder-illustration.tsx
│   │       ├── contact-info-section.tsx
│   │       ├── page-hero.tsx
│   │       ├── platform-cases-section.tsx
│   │       ├── platform-cases-stats-section.tsx
│   │       ├── products-index-section.tsx
│   │       ├── site-footer.tsx
│   │       ├── site-header.tsx
│   │       ├── theme-toggle.tsx
│   │       ├── technology-advantages-section.tsx
│   │       └── technology-pipeline-section.tsx
│   ├── oauth/consent/page.tsx
│   ├── security/two-factor/page.tsx
│   ├── two-factor/page.tsx
│   └── api/**
└── components/
    └── providers.tsx   # global, mounted once in the root layout — the only thing that stays top-level today
```

Notes:

- `(app)/_components/site-header.tsx` and `(public)/_components/site-header.tsx` are different files with the same name — that's fine, they're namespaced by directory now instead of by a `public/` prefix.
- `(public)/_components/about-*-section.tsx` stays at the `(public)/_components/` level rather than sinking to `about/_components/`, even though those three files are currently only used by `about/page.tsx` — deliberately not over-fragmenting into single-file `_components/` folders for a marginal case.
- This tree is the target shape; migrating the existing files into it is a separate, later piece of work, not part of this document.

## Applies to `apps/docs` too

Same rule, once `apps/docs` has more than its one `components/mdx.tsx` file: route-private stuff under the relevant `_components/`, anything genuinely shared across routes at the top level.
