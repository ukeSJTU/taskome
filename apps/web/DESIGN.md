---
name: XDeNovo Public Site
description: AI-native de novo protein design, staged as a lab-white world with a committed layered green and a scarce orange signal.
colors:
    lab: "#f7f5ee"
    lab-100: "#efece0"
    lab-200: "#e3ded0"
    bio-50: "#eaf3ea"
    bio-100: "#d3e8d6"
    bio-200: "#b0d6b6"
    bio-300: "#8bc294"
    bio-500: "#4a8f57"
    bio-600: "#397445"
    bio-700: "#2c5936"
    bio-900: "#142c1a"
    signal: "#d9642a"
    signal-700: "#a8481c"
    signal-800: "#8f3c17"
    signal-ink: "#a8481c"
    ink: "#16241b"
    ink-muted: "#48594c"
    paper: "#f7f5ee"
typography:
    display:
        fontFamily: "Archivo, sans-serif"
        fontWeight: 600
        letterSpacing: "-0.02em"
        lineHeight: 1.08
    body:
        fontFamily: "Inter, sans-serif"
        fontWeight: 400
        lineHeight: 1.6
    data:
        fontFamily: "Geist Mono, ui-monospace, monospace"
        fontWeight: 500
rounded:
    pill: "9999px"
    none: "0px"
components:
    button-primary:
        backgroundColor: "{colors.signal-700}"
        textColor: "{colors.paper}"
        rounded: "{rounded.pill}"
        padding: "12px 24px"
    button-primary-hover:
        backgroundColor: "{colors.signal-800}"
        textColor: "{colors.paper}"
        rounded: "{rounded.pill}"
        padding: "12px 24px"
---

# Design System: XDeNovo Public Site

## Overview

**Creative North Star: "The Lab Register"**

XDeNovo's public site reads like a lab notebook that happens to be beautifully typeset: a warm, uncoated white ground, a committed scale of biological green that owns whole sections rather than accenting a neutral one, and a single orange used only where something real is being pointed at — a binding interface, a primary action, a validated metric. Nothing on the page is decorative structural biology; the ribbon-diagram hero illustration and the ledger-style validation rows are the same visual grammar a researcher already reads daily, brought onto the web without softening it into generic SaaS iconography.

The system deliberately avoids the two default AI-biotech looks: it is not a dark, neon-glow "AI lab at night," and it is not a cream-and-serif academic archive. Confidence comes from typographic scale and color commitment, not from gradients, glass, or icon tiles.

**Key Characteristics:**

- Warm lab-white ground, never stark white.
- Bio-green is committed at the section level (30–60% coverage), not sprinkled as an accent.
- Orange is scarce and always tied to a real, specific thing: the binding interface, a primary CTA, one metric per validation row.
- No cards. Content is organized as ledgers, indexes, and stepped sequences — a lab register, not a dashboard of tiles.

## Colors

The palette is a single committed hue family (green) plus one true accent (orange) on a warm neutral ground; there is no secondary/tertiary hue.

### Primary

- **Bio Green** (`bio-500` `#4a8f57` → `bio-700` `#2c5936`): the system's committed color. Used for section-owning fields (`bio-900` dark sections, `bio-50` tinted sections), the hero illustration's ribbons, body dividers (`bio-200`), and small in-context labels (`bio-600`, 5.1:1 on lab).

### Secondary

- **Signal Orange** (`signal-700` `#a8481c`, hover `signal-800` `#8f3c17`): reserved for exactly three moments — the primary CTA button, the hero illustration's binding-interface marker and terminal ribbon segment, and one metric per validation-case row (`signal-700` on lab, 5.3:1). Never used for decoration, hover states outside the CTA, or a fourth surface.

### Neutral

- **Lab White** (`lab` `#f7f5ee`): base ground for all light sections and card-free content.
- **Lab Paper** (`lab-100` `#efece0`, `lab-200` `#e3ded0`): secondary surface tint (footer) and hairline dividers.
- **Ink** (`ink` `#16241b`): primary text, green-tinted near-black rather than true gray (14.8:1 on lab).
- **Ink Muted** (`ink-muted` `#48594c`): secondary/body copy, tinted from the same hue rather than desaturated gray (6.9:1 on lab).

### Dark Theme

Every color above except `bio-100`/`bio-200`/`bio-300`, `signal-700`/`signal-800`, and `paper` is redefined under a `.dark` selector on `<html>` (toggled by `PublicThemeToggle`, `next-themes`, `attribute="class"`) — the frontmatter above stays the light/default source of truth; the dark values live as CSS custom-property overrides in `apps/web/src/index.css`, not as a second frontmatter block (the DESIGN.md token schema has no dark-mode slot). Derivation, not a separate palette: `lab` inverts to a deep green-black ground (`#0f1e15`), `ink`/`ink-muted` invert to warm parchment tones, and `bio-500`/`600`/`700` brighten so text and illustration strokes stay legible against the dark ground. `bio-900` (the pipeline section's field) deepens further (`#081209`) rather than converging toward the new page background, so it keeps its job as the page's darkest pacing beat in both themes. `bio-100`/`200`/`300` and the button pair are left theme-invariant on purpose — pale hairlines and a filled orange button already read correctly against either ground. `signal-700` intentionally stays two different concerns: the button-background role (`signal-700`/`800`, invariant) and the on-page-text role (`signal-ink`, brightens to `#e2884f` in dark) move independently because a button's internal contrast and a text-on-ground contrast pull in opposite directions between themes.

### Named Rules

**The Three-Moments Rule.** Signal orange appears in exactly three kinds of places: the primary CTA, the binding-interface marker, and one metric per validation row. A fourth use is a violation, not a variant.

**The No-Gray Rule.** Secondary text is never a desaturated gray; it is `ink-muted`, tinted from the same green-black hue as `ink`.

**The Invariant-Ground Rule.** A color used for text or strokes on a surface that is already dark in both themes (`paper`, the pipeline section, filled buttons) never flips with the theme toggle; only colors set against the page's own flipping ground do.

## Typography

**Display Font:** Archivo (with system sans-serif fallback)
**Body Font:** Inter (with system sans-serif fallback)
**Label/Mono Font:** Geist Mono (already loaded app-wide for `--font-geist-mono`)

**Character:** Archivo carries the editorial, structurally confident voice of headlines — geometric enough to read as engineered, not a generic system stack. Inter stays a quiet workhorse for body copy so Archivo's personality isn't competing with itself. Geist Mono is earned only by real data (validation metrics), never used as a "technical" costume.

### Hierarchy

- **Display** (600, `text-4xl`–`text-5xl`, 1.08 line-height, `-0.02em` tracking): hero and section H2s.
- **Title** (500, `text-lg`): row/item headings inside ledgers (validation cases, products).
- **Body** (400, `text-sm`–`text-lg`, 1.6 line-height, max ~65ch): all paragraph copy.
- **Data** (500, `text-sm`, mono): validation metrics only.

### Named Rules

**The Earned Mono Rule.** Monospace is used only for values a lab would actually record as data (affinity, stability, specificity metrics) — never as a stylistic label for "technical" content.

## Layout

Single-column, single-scroll marketing page, `max-w-6xl` (hero/pipeline) or narrower `max-w-3xl`–`max-w-4xl` reading measures for text-dense sections, centered with `px-6` gutters. Sections alternate background field (lab / bio-50 / lab / bio-900 / lab / lab) to pace the scroll rather than repeating one card rhythm. Vertical rhythm is generous: `py-24` between major sections, `py-6`–`py-7` between ledger rows. Responsive collapse is single-column below `md`; the three-column footer and multi-column ledger rows stack to one column.

## Elevation & Depth

Flat by design — no shadows anywhere. Depth comes from color-field changes between sections (the `bio-900` pipeline section reads as a distinct "layer" purely through hue, not elevation) and from hairline dividers (`border-bio-200`) separating ledger rows, never from `box-shadow`.

## Shapes

Two shapes only: fully rounded pills (`rounded-full`, buttons and the CTA) and hard right angles everywhere else (no card radius, because there are no cards — content sits in flat ledgers separated by 1px hairlines). No intermediate radius scale exists yet.

## Components

### Buttons

- **Shape:** pill (`rounded-full`).
- **Primary:** `signal-700` background, `lab` text, `px-6 py-3`, `text-sm font-medium`.
- **Hover:** background steps to `signal-800`.
- **Ghost/text link:** `ink-muted` text, no background, hover steps to `bio-700`.

### Ledger rows (signature component)

Replaces cards as the page's structural unit. A ledger row is a horizontal grid (stacks on mobile) separated by `divide-y border-bio-200` hairlines: a title in Archivo, supporting copy in Inter, and — where real data exists — a right-aligned data value in Geist Mono/`signal-700`. Used for platform validation cases and the products index. No border, no background fill, no radius.

### Stepped sequence

Used once, for the four-stage design pipeline: numbered circular markers (`border-bio-500`) connected by a hairline, laid out on the dark `bio-900` field. Numbering is earned here because the sequence itself is the information (an ordered pipeline), not decoration.

### Navigation

Sticky header, `lab/90` with backdrop blur, `border-b border-bio-200`. Anchor links in `ink-muted`, hover to `bio-700`, no underline. Wordmark splits color: "XDe" in `ink`, "Novo" in `bio-600`. A mobile menu (below `md`) expands as a grid-row disclosure under the header, same tokens, no overlay/modal.

### Theme Toggle

A single icon button (`Moon`/`Sun`, 16px, `bio-200` border) cycling light/dark, styled from the system's own tokens rather than the shared shadcn `ModeToggle` — a generic neutral-gray dropdown control would break world consistency on an otherwise fully committed page.

## Do's and Don'ts

### Do:

- **Do** keep bio-green committed at section scale (30–60% coverage) rather than as a small accent.
- **Do** treat signal orange as earned, not decorative — tie every use to a real thing (CTA, interface, metric).
- **Do** use ledger rows with hairline dividers for any new list content, not bordered/background cards.
- **Do** tint secondary text from the ink hue (`ink-muted`), never a desaturated gray.

### Don't:

- **Don't** introduce a card grid (icon + heading + text, same-size tiles) as page structure — this system has no card component by design.
- **Don't** add a kicker/eyebrow label above headings; fold category or context into the heading or body prose instead (a category label was removed from the products index during finish review for exactly this reason).
- **Don't** use signal orange for hover states, decoration, or a fourth surface beyond the three named moments.
- **Don't** introduce shadows; depth comes from color-field changes and hairlines only.
- **Don't** reuse a filled-button color token for on-page text (or vice versa) without checking both themes — the two roles move in opposite directions between light and dark and silently break contrast in one of them.
