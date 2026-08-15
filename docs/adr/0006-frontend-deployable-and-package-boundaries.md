---
status: accepted
date: 2026-08-15
decision-makers: Taskome maintainers
---

# apps/web hosts the public site and the product together; apps/docs is the one deliberate exception

## Context and Problem Statement

Taskome's frontend surface spans several concerns: the authenticated product, XDenovo's public marketing site, and Taskome's own API/developer documentation — plus shared UI building blocks used across whichever of these end up as separate deployments. When does a piece of frontend surface earn its own `apps/*` deployment, versus living inside an existing app? And once there's more than one frontend app, how do they share UI without a publish step?

## Decision Drivers

- Root `AGENTS.md`'s "Today's requirements" and "Incremental delivery" principles: don't create a new deployable unless it earns its own operational cost.
- The public marketing site and the authenticated product are different audiences, but both are ordinary Next.js pages needing the same tooling.
- Taskome's own documentation benefits from a purpose-built docs toolchain (Fumadocs) that doesn't fit naturally inside the product's Next.js app.
- Publishing an internal UI package to a registry is unnecessary overhead when every consumer is a sibling app in the same monorepo.

## Considered Options

- One `apps/*` deployment per distinct audience or concern (public site, product, and docs each separate)
- Group by shared technology and tooling needs, not audience — only split out what genuinely needs different tooling
- One single deployment for everything, including docs

## Decision Outcome

Chosen option: "Group by shared technology and tooling needs, not audience", because it avoids paying for a separate deployment where nothing about the tooling actually differs, while still giving docs the purpose-built toolchain it needs.

`apps/web` hosts both XDenovo's public marketing site (the `(public)` route group) and the authenticated Taskome product (the `(app)` route group) in one Next.js deployment — they're different audiences, but neither needs different technology, and splitting them would mean operating two deployments for the cost of one. `apps/docs` gets its own deployment, because Fumadocs is a genuinely different toolchain that doesn't belong bolted onto the product app. Two corollary decisions follow the same logic: `next-intl` locale routing covers `(public)` and `(auth)` (both need to be reachable by a broad, language-diverse audience), while the authenticated `(app)` dashboard stays English-only and unprefixed, matching `vision.md`'s "semi-internal, known users" framing. `@taskome/ui` is consumed as raw source by both `apps/web` and `apps/docs` — no build or publish step — because every consumer is a sibling in the same monorepo; `apps/docs` takes only its theme tokens, not full components, keeping Fumadocs' own UI independent of the product's component library.

### Consequences

- Good, because fewer deployables need to be built, deployed, and monitored for surfaces that don't need different tooling.
- Good, because docs gets exactly the toolchain it needs without dragging that dependency into the product app, or forcing docs to hand-build what Fumadocs already provides.
- Good, because internal UI sharing costs nothing extra — no registry, no versioning, no publish step to maintain.
- Bad, because `apps/web` now serves two different products (the company's public identity and Taskome's platform) from one deployment — an outage or a bad deploy affects both at once, even though they're conceptually unrelated.
- Bad, because the i18n scope split (`(public)`/`(auth)` localized, `(app)` not) needs ongoing discipline as routes are added — it's not enforced by anything structural.

### Confirmation

A new route added to `apps/web` should be checked against which route group it belongs to (see `apps/web/AGENTS.md`'s Route boundaries) rather than assumed. A new frontend surface that needs different tooling than Next.js (the way Fumadocs did for docs) is the signal to consider a new `apps/*` deployment — needing different technology, not just serving a different audience, is the bar.

## Pros and Cons of the Options

### One deployment per audience (including a separate public-site app)

- Good, because each surface's availability and scaling are fully independent.
- Bad, because it means operating a separate deployment for a small marketing site that needs nothing technically different from the product app — pure operational overhead with no corresponding benefit.

### Group by shared tooling needs (chosen)

- Good, because it only pays the cost of a separate deployment where the tooling genuinely differs.
- Neutral, because it couples the public site's and the product's availability, which the "one deployment per audience" option would have avoided.

### One single deployment for everything, including docs

- Good, because it's the simplest possible count of deployables.
- Bad, because it would force Fumadocs into the product's Next.js app (or force hand-building documentation UI without it) for no benefit — docs genuinely needs different tooling, and this option ignores that.

## More Information

See [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) for the route-boundary rules this decision produces, and [`apps/docs/AGENTS.md`](../../apps/docs/AGENTS.md) for the theme-only UI consumption rule. Revisit if the public site ever needs technology genuinely different from the product app (the same bar that justified docs splitting out), or if `apps/web` serving two products from one deployment becomes a demonstrated availability problem.
