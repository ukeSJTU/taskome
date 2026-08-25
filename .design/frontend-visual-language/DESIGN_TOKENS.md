# Design Tokens: XDenovo frontend visual language

## Token model

The token system implements one identity with two surface layers:

| File                                        | Responsibility                                                                                       | Current adoption                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/ui/src/styles/tokens/base.css`    | Shared brand palette, type roles, spacing, layout, radius, shadow, motion, breakpoints, and stacking | Available to both surfaces                                    |
| `packages/ui/src/styles/tokens/web.css`     | Editorial Web semantics and shadcn compatibility aliases                                             | Connect during Web implementation                             |
| `packages/ui/src/styles/tokens/console.css` | Console semantics, density, lifecycle status, charts, navigation, and light/dark themes              | Specification only; do not import in Console during this flow |

Each surface file imports `base.css`. Components consume semantic names such as `--color-text-primary` and `--color-accent-primary`; they do not consume raw OKLCH values.

## Aesthetic derivation

The Web tokens derive from the **Editorial / Magazine** philosophy with these deliberate adaptations:

- laboratory white replaces pure print white;
- fresh green supplies biological context without turning every element green;
- signal orange marks the only primary action;
- thin rules, restrained radii, and typography provide structure instead of card shadows; and
- the dark palette exists for completeness, while the current Web implementation remains light-first.

The Console tokens combine **Dieter Rams functionalism** with a mature SaaS surface:

- semantic state and information density take priority over decoration;
- light and dark palettes receive equal treatment;
- compact and comfortable row heights share a four-pixel foundation;
- borders and tonal surfaces do more work than shadows; and
- the same green and signal orange retain brand continuity without importing editorial layouts.

## Typography

| Role            | Family        | Use                                                                          |
| --------------- | ------------- | ---------------------------------------------------------------------------- |
| Display         | Newsreader    | Web Hero and major editorial headings only                                   |
| Body and UI     | IBM Plex Sans | Web body, navigation, actions, and future Console UI                         |
| Scientific data | IBM Plex Mono | Sequences, parameters, identifiers, versions, commands, and compact metadata |

The font stack includes Noto fallbacks for future Simplified Chinese content. The current English page should load only the Latin subsets and weights it uses. Console overrides the display role to the body family.

## Color roles

### Shared brand foundations

- **Laboratory paper** `oklch(0.985 0.007 115)` is the Web canvas.
- **Scientific ink** `oklch(0.19 0.025 155)` replaces pure black.
- **Fresh green** spans quiet biological surfaces, scientific traces, links, focus, and secondary emphasis.
- **Signal orange** `oklch(0.58 0.2 38)` is reserved for Sign in and rare high-priority actions.
- The archived blue-cyan logo gradient is a brand-asset exception. Do not derive interface gradients from it.

### Action and status separation

Signal orange identifies a chosen action. Warning uses a more yellow amber. Failure uses a redder hue. A component must pair status color with a label, icon, shape, or position; color never carries lifecycle meaning alone.

Console lifecycle tokens cover the accepted Attempt states:

| Attempt state | Semantic treatment | Phases that inherit it            |
| ------------- | ------------------ | --------------------------------- |
| `queued`      | Quiet blue-grey    | `awaiting_resources`, `preparing` |
| `running`     | Active cyan-blue   | `executing`, `publishing`         |
| `cancelling`  | Amber              | `stopping`, `reconciling`         |
| `succeeded`   | Fresh green        | Terminal success                  |
| `failed`      | Red                | Terminal failure                  |
| `cancelled`   | Neutral grey       | Terminal cancellation             |

Do not assign separate colors to phases. The interface shows the phase as supporting text inside its parent state.

## Contrast evidence

The key combinations were converted from OKLCH to relative luminance and checked with the WCAG contrast formula:

| Combination                                     | Contrast |
| ----------------------------------------------- | -------: |
| Scientific ink on laboratory paper              |  17.61:1 |
| Secondary Web text on laboratory paper          |   7.64:1 |
| White text on light-theme signal orange         |   4.55:1 |
| Deep green link on laboratory paper             |   9.97:1 |
| Dark-theme primary text on Console background   |  16.26:1 |
| Dark-theme secondary text on Console background |   8.46:1 |
| Dark ink on dark-theme signal orange            |   6.95:1 |

These values cover the primary text and action pairs. Component implementation must still check contrast after opacity, blending, hover, disabled state, or placement over imagery changes the final rendered color.

## Spacing and density

The shared scale starts at four-pixel increments and expands to editorial section spacing. Web uses `--web-section-space` for large narrative separation instead of multiplying component padding. Console uses explicit control and row-height tokens:

- small control: 28 px;
- default control: 36 px;
- large or touch control: 44 px;
- compact row: 32 px; and
- comfortable row: 40 px.

Compact density is for desktop data work. Interactive controls exposed on touch layouts still require a 44 by 44 CSS-pixel target, even when the visible control is smaller.

## Radius, border, and shadow

- Web controls use an 8 px radius. Editorial panels prefer a 4 px radius or no container.
- Console controls use an 8 px radius and panels use a 12 px radius.
- Pills are reserved for statuses, filters, and compact metadata whose shape carries meaning.
- Use hairline rules and tonal surfaces before shadows.
- Use the medium or large shadow only for content that changes stacking context, such as menus, dialogs, and raised scientific overlays.

## Motion

Motion uses a restrained ease-out curve and four duration tiers. Avoid bounce and continuous ambient animation. The reduced-motion media query changes all shared duration tokens to `0.01ms`.

Web may reveal a rule, label, or scientific trace after content is present. Console motion communicates a state change, navigation transition, or overlay. Neither surface may delay reading or interaction until an animation finishes.

## Theme activation

Surface files use `light-dark()` so every semantic variable declares both palettes in one place. The computed `color-scheme` selects the active value.

Web uses a light default:

```html
<html data-surface="web" data-theme="light"></html>
```

The dark Web palette remains available for later work, but this flow does not add a Web theme switch.

Console follows the system until the user chooses a theme:

```html
<html data-surface="console"></html>
```

The Console file supports both the existing `.light` / `.dark` classes and future `data-theme="light"` / `data-theme="dark"` selectors. The `prefers-color-scheme` query applies dark mode only when no explicit light choice exists.

## Shared component compatibility

Both surface files map their semantic variables back to the current shadcn names such as `--background`, `--primary`, `--border`, and `--ring`. This mapping lets existing accessible primitives participate in the new system without duplicating their behavior.

Compatibility aliases do not mean the two surfaces use identical compositions. Web composes editorial sections. Console composes navigation, forms, tables, lifecycle states, charts, and Utility workspaces.

## Adoption boundary

This phase creates the token files but does not expose or import them through `@taskome/ui` yet. The Web implementation phase will:

1. add stable package exports for the token entry points;
2. mark the Web root with `data-surface="web"` and an explicit light theme;
3. load the selected font families; and
4. import the Web token layer after the existing Tailwind foundation.

Do not import `console.css` from `apps/console` in this design flow. A later Console migration must validate every existing primitive and screen in both themes before replacing the current globals.

## Related design context

- [Frontend visual-language design brief](./DESIGN_BRIEF.md)
- [Frontend information architecture](./INFORMATION_ARCHITECTURE.md)
