# Rebuild public website in apps/web with locale-prefixed i18n

`apps/web` now serves two purposes: the internal authenticated tool platform (existing scope) and XDenovo's public corporate website (the `(public)` route group), replacing the legacy Vite/React SPA kept for reference at `references/old-website`. We rebuild on apps/web's existing Next.js/Tailwind stack rather than standing up a separate site or repo, and switch i18n from the old site's client-only language toggle to `next-intl` with locale-prefixed routes (`/en/...`, `/zh/...`) so each language gets an independently indexable, crawlable URL with `hreflang` alternates — the old approach couldn't be indexed per-language at all.

Page inventory and visual/3D treatment are deliberately out of scope here — picked up in a follow-up design pass, not assumed to match `references/old-website`.
