# Scope next-intl i18n to the public site and auth pages, not the dashboard

ADR-0018 committed to `next-intl` with locale-prefixed routes (`/en/...`, `/zh/...`) for the public website but left open whether that scope extends to `(auth)` (login/signup) or `(app)` (the authenticated dashboard). We're drawing the line at the logged-out experience: `(public)` and `(auth)` both move under a `[locale]` segment and into the `next-intl` middleware matcher now; `(app)` stays out entirely, unlocalized and unprefixed.

`(auth)` is included because it's the front door reached directly from a localized `(public)` page (e.g. a sign-up CTA) — leaving it English-only under a locale-prefixed site would be a confusing half-state for the one flow a Chinese-reading visitor actually completes. Its content is also small and already real (~30 strings across the login/signup forms), so translating it now is bounded work, unlike `(public)`'s still-placeholder page content (deferred by ADR-0018) or `(app)`'s much larger surface. We also adopt the `@better-auth/i18n` plugin now, for the same reason `(auth)` is in scope — it only localizes Better Auth's server-side error strings and is mechanically independent of URL routing (resolves locale via header/cookie/session, not path), so it doesn't depend on or duplicate the `next-intl` work.

`(app)` is deferred, not designed around: there is no current non-English-speaking user base for the dashboard, and Next.js route groups are URL-transparent, so `next-intl` doesn't need `(app)`'s eventual scope decided upfront. Adding i18n to `(app)` later is an independent folder move (into or alongside the `[locale]` segment) plus a middleware matcher edit, with no rework of what's built now for `(public)`/`(auth)`. Revisit only if/when the dashboard actually ships to a non-English-speaking audience.

## Consequences

- `apps/web` gets its first `middleware.ts`, scoped explicitly to `(public)` and `(auth)` paths — excluding `/dashboard`, `/api/*`, and Better Auth's own routes — so the authenticated tool platform stays fully decoupled from this change.
- Locales: `en` (default, unprefixed) + `zh-CN` (prefixed `/zh`), as hand-authored JSON message catalogs checked into the repo — no translation service.
