# Design Brief: XDenovo frontend visual language

## Problem

Protein-design researchers need to understand what XDenovo builds, why Taskome is useful, and how to start using it without translating generic AI marketing into a credible scientific workflow.

XDenovo's public site and the Taskome Console serve different jobs. The public site must establish the company, explain its scientific point of view, and introduce Taskome. The Console must help researchers work efficiently with Tools, Jobs, Attempts, Projects, scientific files, and Utilities. If the two surfaces look unrelated, the product loses trust and continuity. If they use identical layouts and density, neither surface serves its job well.

The current public site is a placeholder. The Console has a functional SaaS foundation, but its neutral shadcn-derived theme does not yet express a deliberate XDenovo visual identity. The previous XDeNovo site contains approved company content and a usable brand mark, but its dark neon treatment, particle effects, and simulated molecule visuals do not match the new direction.

## Solution

Create one frontend visual language with three layers:

1. A shared base defines the brand foundations, typography roles, spacing logic, motion rules, accessibility defaults, and common semantic concepts.
2. A Web surface applies those foundations to a light-first, editorial biotechnology experience with generous space and scientific storytelling.
3. A Console surface applies the same foundations to a compact, mature SaaS interface that feels like a precise scientific instrument. Light and dark themes receive equal design support.

This design flow implements one production-quality English page in `apps/web`. The page presents XDenovo as the master brand and Taskome as its current flagship product. It implements English technical SEO and a lightweight two-dimensional scientific visual. The flow specifies Console tokens and component behavior without changing Console page code.

## Audience and jobs to be done

The primary audience is a protein-design researcher who runs scientific compute directly. The researcher needs to:

- recognize that XDenovo understands protein-design work rather than offering a generic AI platform;
- understand Taskome's curated compute model and the difference between Tools, Jobs, Attempts, Projects, and Utilities;
- see that Taskome supports browser, MCP Agent, Direct API Client, and CLI access without changing its domain model; and
- reach Taskome sign in without navigating a broad company site.

Research leads and R&D decision-makers are a secondary audience. They need concise evidence of scientific credibility, reproducibility, privacy, and operational consistency.

## Success criteria

The design succeeds when:

- the Web page reads clearly as an XDenovo company page with Taskome as the flagship product;
- a researcher can identify Taskome's purpose and reach sign in from the first viewport;
- the visual identity feels credible in both an editorial marketing context and a future high-density Console context;
- the Web page remains coherent from 375 px mobile layouts through wide desktop layouts;
- the English page ships with semantic HTML, useful metadata, canonical information, Open Graph data, `robots.txt`, a sitemap, and appropriate structured data;
- the experience meets WCAG 2.2 AA expectations for contrast, keyboard use, focus visibility, landmarks, reduced motion, and target sizing;
- the design specifies a complete light and dark Console token system without changing Console pages in this flow; and
- the page communicates its argument without requiring animation, WebGL, or JavaScript-only content.

## Experience principles

1. **One identity, two working modes** -- Share recognizable foundations across Web and Console, then tune composition, density, and theme behavior for the job of each surface.
2. **Scientific evidence over AI spectacle** -- Use domain language, structured scientific graphics, and product behavior to build trust. Avoid effects that merely signal futurism.
3. **A clear path over a complete catalog** -- Lead from XDenovo's point of view to Taskome and sign in. Compress supporting capabilities instead of reproducing every legacy page.

## Aesthetic direction

- **Web philosophy**: Editorial / Magazine adapted to a bright scientific laboratory. Use disciplined asymmetry, a strong typographic hierarchy, generous white space, annotated scientific graphics, and occasional grid-breaking composition.
- **Console philosophy**: Precision scientific instrument combined with a mature, approachable SaaS product. Favor clarity, density, explicit state, and predictable interaction without becoming sterile.
- **Tone**: Fresh, authoritative, technically literate, calm, and optimistic.
- **Color intent**: Laboratory white and paper-like neutrals form the base. Fresh green provides biological and scientific accents. A signal orange creates strong contrast for the primary CTA and rare high-priority emphasis. Color must remain semantic and sparse.
- **Logo treatment**: Reuse the approved blue-cyan XDeNovo mark from the archived site. Treat its gradient as a brand-asset exception rather than a palette source. Produce a single-color dark-ink variant for small, quiet, or high-density contexts.
- **Typography intent**: Share a clear sans-serif family for body copy, navigation, controls, and future Console UI. Share a monospace family for sequences, parameters, identifiers, and version data. Add an editorial serif display face on the Web surface only.
- **Reference points**: The information clarity of [Tamarind Bio](https://www.tamarind.bio/), the product-centered scientific narrative of [ProteinIQ](https://proteiniq.io/), and the workbench framing of [subseq.bio](https://subseq.bio/docs). These are interaction references, not scope definitions.
- **Internal reference**: The archived site at `references/old-website` supplies approved company facts, legal and contact content, and the existing mark.
- **Anti-references**: Generic purple-gradient AI SaaS pages, dark neon particle fields, repeated glass cards, fake molecule decoration, excessive rounded containers, unsubstantiated scientific claims, and an oversimplified no-code tone.

## Content direction

The single English page uses this narrative:

- XDenovo builds AI-native biotech products.
- Protein-design work needs curated scientific compute and durable provenance, not another one-off environment.
- Taskome is XDenovo's flagship platform for running, managing, and reproducing protein-design compute.
- Taskome connects curated Tools, immutable Jobs, execution Attempts, Projects, scientific files, and browser Utilities.
- Researchers can reach the same Taskome concepts through the Web App, an MCP Agent, a Direct API Client, or the CLI.
- XDenovo also has scientific capabilities in peptide and protein design. The page compresses the archived service catalog into one supporting section instead of restoring a full product grid.

**Sign in** is the only CTA in this version and leads to Taskome's login journey. **Docs** is a first-level Header destination rather than a secondary CTA. The page does not promote registration, booking, or sales contact in this flow.

Content from the archived site is approved as current source material. The implementation may edit it for hierarchy, length, grammar, and the new company/product model without changing its factual meaning.

## Existing patterns

- **Applications**: `apps/web` is a Next.js 16 App Router marketing site. `apps/console` is a Vite and TanStack Router authenticated product application.
- **Shared UI**: Both applications consume primitives and styles from `@taskome/ui` in `packages/ui`.
- **Typography**: Shared styles currently load Inter. The Web root also loads Inter through `next/font`. There is no defined display or data type family.
- **Colors**: `packages/ui/src/styles/globals.css` exposes neutral shadcn-style light and dark variables in OKLCH plus blue chart colors. These variables are a functional starting point, not the target brand palette.
- **Spacing and radius**: Tailwind CSS supplies the spacing scale. Shared primitives use a `0.625rem` base radius and frequently apply large rounded corners.
- **Components**: The shared package already includes buttons, navigation menus, cards, badges, tables, dialogs, forms, tooltips, sidebars, charts, empty states, and other shadcn-derived primitives.
- **Console themes**: The Console uses `next-themes`, currently defaults to dark, and exposes light, dark, and system choices. The target design makes system the default and treats light and dark as equal-quality themes in a later Console implementation task.
- **Icons**: Console compositions use Lucide. The Web may use the same icon vocabulary when an icon conveys information rather than decoration.
- **Design tooling**: The repository has no Storybook, token JSON export, or separate documented token system.

The design extends this vocabulary. It does not replace accessible primitives that already solve interaction behavior.

## Styling architecture

The target styling model has three CSS layers:

| Layer         | Responsibility                                                                                          | Adoption in this flow                               |
| ------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `base.css`    | Shared brand foundations, typography roles, scale, motion, focus, and cross-surface semantic primitives | Implement and use on Web                            |
| `web.css`     | Light-first editorial marketing tokens and Web-specific semantic aliases                                | Implement and use on Web                            |
| `console.css` | Light and dark SaaS tokens, density, data, status, navigation, and scientific-workspace aliases         | Specify completely; do not connect to Console pages |

The exact paths and import boundaries are decided during the Design Tokens phase. The implementation must not replace Console globals or cause an incidental Console redesign.

## Component inventory

| Component                       | Status | Notes                                                                                                                              |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| XDenovo brand mark              | Modify | Copy the approved archived asset and add a single-color variant.                                                                   |
| Marketing header                | New    | Anchored navigation, Docs, Sign in, and responsive menu behavior.                                                                  |
| Shared button primitive         | Modify | Reuse behavior; add a signal-orange Sign in action and restrained navigation treatments.                                           |
| Editorial hero                  | New    | Company positioning, primary actions, and a lightweight scientific visual.                                                         |
| Scientific visual               | New    | Responsive SVG/CSS composition based on protein structure and compute traces; no Three.js in this flow.                            |
| Editorial section heading       | New    | Supports labels, display headlines, summaries, and optional annotations.                                                           |
| Scientific argument section     | New    | Explains why protein-design compute needs a shared platform.                                                                       |
| Taskome product story           | New    | Presents the domain model and workflow without pretending to be an interactive Console.                                            |
| Access-channel composition      | New    | Shows Web App, MCP Agent, Direct API Client, and CLI as equivalent journeys.                                                       |
| Scientific capabilities section | New    | Condenses the approved legacy service catalog.                                                                                     |
| Company section                 | New    | Reuses approved company, team, and mission content in a concise form.                                                              |
| Final CTA                       | New    | Repeats the same Sign in destination without introducing a second conversion action.                                               |
| Marketing footer                | New    | Company identity, contact and legal information, and relevant destinations.                                                        |
| Console token map               | New    | Defines both themes, density, component states, scientific statuses, and visualization semantics. Documentation/token output only. |

## Key interactions

- Header links scroll to meaningful page sections and update focus without obscuring the target behind a sticky header.
- Sign in opens the existing Taskome login journey. Docs opens the Taskome documentation site. External navigation remains visually distinct where needed.
- The mobile header collapses into an accessible disclosure. Opening it moves focus into the menu; closing it restores focus to the trigger.
- Hover and scroll effects reinforce hierarchy but never hide content or carry essential meaning.
- The scientific visual responds subtly to the viewport and reduced-motion preference. Screen-reader users receive a concise text equivalent when the visual conveys information; purely decorative layers remain hidden.
- A future Three.js enhancement may replace the visual layer. It must preserve the same content, layout slot, fallback, and interaction-free reading path.

## Responsive behavior

- Design mobile-first from 375 px, then introduce editorial asymmetry when space permits.
- Collapse navigation into a disclosure on small screens. Keep Sign in prominent without crowding the header.
- Stack the Hero copy and scientific visual on narrow screens. The visual becomes a cropped or simplified composition rather than a scaled-down desktop poster.
- Use fluid type with bounded minimum and maximum sizes. Avoid headings that leave isolated words or dominate short mobile viewports.
- Convert wide diagrams and comparison compositions into ordered vertical narratives. Preserve reading order in the DOM.
- Keep body text at a comfortable measure on wide screens. Use the remaining width for art direction, annotations, and structure rather than longer lines.
- The future Console specification assumes desktop-efficient layouts with functional mobile fallbacks. It does not force marketing spacing or editorial layouts into product screens.

## Accessibility requirements

- Meet WCAG 2.2 AA contrast: at least 4.5:1 for normal text and 3:1 for large text and essential interface graphics.
- Provide visible, consistent focus treatment that works on white, green-tinted, dark, and signal-orange surfaces.
- Make all navigation and disclosure interactions keyboard operable. Manage focus when the mobile menu opens and closes.
- Use semantic landmarks and one logical heading hierarchy. Anchor destinations must receive useful labels and scroll offsets.
- Maintain minimum 44 by 44 CSS-pixel targets for primary touch controls.
- Do not rely on green, orange, or any other color alone to communicate meaning.
- Respect `prefers-reduced-motion`. Disable nonessential translation, parallax, and continuous movement.
- Give informative scientific graphics a text equivalent. Hide decorative traces and textures from assistive technology.
- Preserve content and actions when images, custom fonts, CSS animation, or client-side JavaScript fail.

## Performance and SEO constraints

- Do not add Three.js or another WebGL runtime in this implementation.
- Prefer server-rendered content and CSS/SVG presentation. Keep client components limited to interactions that need browser state.
- Optimize copied raster assets and provide explicit dimensions. Avoid shipping the archived 2048 px logo when a smaller derivative is sufficient.
- Load only the font weights and character sets used by the English page.
- Implement useful English title and description metadata, canonical information, Open Graph data, `robots.txt`, a sitemap, and validated structured data appropriate to the company and software product.
- Keep all essential copy in HTML so search engines and no-script users receive the complete narrative.

## Internationalization direction

This flow does not install an i18n library or publish translated routes. The architecture documentation must preserve these future requirements:

- English and Simplified Chinese are the first planned locales.
- Localized pages use stable, explicit locale paths such as `/en/...` and `/zh-cn/...`.
- Each locale has localized metadata, canonical URLs, alternate-language links, and sitemap entries.
- Components support longer copy and do not embed English strings inside reusable visual primitives.
- Translation does not change canonical Taskome domain terms without an explicit terminology decision.

## Console specification requirements

The Console design output must define, for light and dark themes:

- application background, raised surfaces, overlays, borders, focus, selection, and disabled states;
- sidebar, top-level navigation, breadcrumbs, command search, and settings navigation;
- compact and comfortable density expectations for forms, tables, lists, and panels;
- semantic colors and non-color indicators for Job and Attempt lifecycle states;
- Project and file organization patterns;
- empty, pending, error, not-found, destructive, and success feedback;
- chart series, thresholds, legends, tooltips, and accessible data alternatives;
- scientific Utility workspaces where the viewer or editor is primary and surrounding chrome recedes; and
- system-default theme behavior plus a persistent light/dark/system switch.

These requirements are a future implementation contract. They do not authorize changes under `apps/console` during this flow.

## Out of scope

- Changing any Console page, route, component, or current theme behavior.
- Installing or wiring Web internationalization.
- Publishing Simplified Chinese content in this flow.
- Building multiple marketing routes for Taskome, About, services, contact, privacy, or legal content.
- Recreating every archived page or service card.
- Designing a new XDenovo logo. Only approved asset adaptation is included.
- Adding Three.js, WebGL, an interactive molecule viewer, or a continuous particle background.
- Adding a CMS, blog, analytics stack, contact form backend, pricing, billing, or sales workflow.
- Expanding Taskome beyond the accepted launch scope or presenting scientific interpretation as a Taskome capability.
- Treating future Pipelines, collaboration, payments, training, or scientific recommendations as current product features.

## Related project context

- [Taskome product vision](../../docs/product/vision.md)
- [Taskome domain vocabulary](../../CONTEXT.md)
- [XDenovo marketing-site boundary](../../apps/web/README.md)
- [Taskome Console boundary](../../apps/console/README.md)
