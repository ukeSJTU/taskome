# Design Tokens: XDenovo frontend visual language

## Token model

The token system implements one identity with two surface layers:

| File                                        | Responsibility                                                                                       | Current adoption                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/ui/src/styles/tokens/base.css`    | Shared brand palette, type roles, spacing, layout, radius, shadow, motion, breakpoints, and stacking | Imported by both surface token files                          |
| `packages/ui/src/styles/tokens/web.css`     | Editorial Web semantics and shadcn compatibility aliases                                             | Imported by `apps/web`                                        |
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

## Console component behavior contract

This section is the implementation contract for a later Console migration. It applies to both light and dark themes and does not authorize changes under `apps/console` in this flow. The migration should adopt one component family at a time and verify every state named below before replacing the current Console globals.

### Application shell and navigation

- The expanded sidebar uses `--console-sidebar-width`; the collapsed rail uses `--console-sidebar-width-collapsed`. Collapsing preserves every destination as an icon button with an accessible name and a tooltip.
- Active navigation combines `--color-navigation-active-bg`, `--color-navigation-active-indicator`, an icon, and a text label. Color alone never identifies the current route.
- The top bar uses `--console-header-height` and keeps global search, account controls, and page-level actions visually separate from sidebar destinations.
- Breadcrumbs show hierarchy, not browser history. The final item is plain text with `aria-current="page"`; earlier items remain links.
- Command search is available from the top-level shell, labels its keyboard shortcut, traps focus only while open, and returns focus to its trigger when closed.
- Settings keep their own persistent secondary navigation. Product destinations do not move into settings merely because both use a sidebar pattern.

### Density, forms, tables, lists, and panels

- Forms and ordinary actions use the 36 px default control height. Primary touch layouts use the 44 px large control height and maintain a 44 by 44 CSS-pixel target.
- Data tables and dense metadata lists use the 32 px compact row only on pointer-oriented layouts. Editable rows, touch layouts, and mixed-content lists use the 40 px comfortable row.
- Tables keep column headers visible, align comparable numbers with tabular numerals, and move row actions into a stable final column. A responsive fallback preserves field labels instead of forcing horizontal clipping.
- Panels use `--console-panel-gap` and the raised or sunken surface tokens. Borders separate related work; shadows are reserved for overlays and temporarily raised content.
- Disabled controls use the disabled background, text, and border tokens plus `--console-disabled-opacity`. They retain a readable label, expose the reason when it is not evident, and never rely on reduced opacity alone.
- Loading does not erase the previous stable layout. Skeletons match the final content shape; action-level pending states retain the action label and prevent duplicate submission only after the request starts.

### Job and Attempt lifecycle

- Every lifecycle treatment pairs the state label with a consistent icon or shape. Queued, running, cancelling, succeeded, failed, and cancelled use their dedicated foreground and background token pairs.
- Attempt phases remain supporting text under their parent state. Do not assign phases separate colors or present a phase as another lifecycle state.
- A Job view keeps the immutable request visually separate from its Attempt history. Retry creates or reveals another Attempt row rather than replacing the earlier record.
- Terminal success, failure, and cancellation remain distinguishable in monochrome and high-contrast viewing through labels, icons, and placement.

### Project and scientific-file organization

- Project context appears in the page title or a stable selector before Job and file collections. `Default Project` is visually identifiable but not styled as a separate ownership class.
- Job, Attempt, Job Output, saved-file, and Utility labels follow `CONTEXT.md`; UI copy does not collapse them into generic “runs” or “artifacts.”
- File rows lead with name and format, then show Project, size, origin or provenance, and modified metadata. Preview, download, move, archive, and delete remain explicit actions.
- Moving a Job or saved file between Projects is presented as organization, not transfer of ownership or provenance. Destructive copy never implies that deleting a Project cascades to its contents.

### Empty, pending, error, not-found, destructive, and success feedback

- Empty states name the missing object and offer one relevant next action when the user can resolve the state. They do not fill data workspaces with promotional illustration.
- Page-level pending states reserve the final layout. Inline pending states stay adjacent to the control or record that initiated them.
- Errors state what failed and the next safe action. Validation errors remain next to their field; request failures use the error token and an alert role without replacing still-valid page content.
- Not-found states distinguish a missing route or record from an authorization failure. They provide a real navigation destination instead of a browser-back-only recovery path.
- Destructive actions use the error semantic, name the affected object, and require confirmation or a recoverable undo window. Success feedback confirms the completed object or action without blocking continued work.

### Charts and scientific data

- Chart series use `--color-chart-1` through `--color-chart-5` consistently within one view. Series also differ by direct label, marker, or line treatment.
- Grid lines use `--color-chart-grid`. Thresholds use `--color-chart-threshold`, a non-solid line treatment, and a text label; threshold meaning never depends on hue alone.
- Legends remain visible when more than one series exists. Tooltips work with pointer, keyboard focus, and touch and repeat the series name, x value, y value, and unit.
- Every decision-relevant chart provides the same values in an accessible table or downloadable data representation. Screen-reader users do not need to infer values from an SVG path.

### Utility workspaces

- A Utility makes its viewer or editor the primary region. Surrounding navigation uses the compact utility chrome height and recedes through the sunken surface token.
- File identity, format, provenance, save or export state, and the return destination remain available without covering the scientific canvas.
- Inspectors may collapse, but their trigger stays visible and restores focus. Full-screen modes preserve an obvious exit action and the browser's Escape behavior.
- Unsupported or failed previews show the format, explain the limitation, and retain safe download or return actions. They never manufacture a Job or Attempt.

### Theme selection and persistence

- With no stored preference, Console follows `prefers-color-scheme`. The theme control exposes System, Light, and Dark as equal choices.
- An explicit choice persists across sessions and applies before first paint to avoid a light/dark flash. System remains selected as a preference rather than being converted into the system's current color.
- The root sets the matching `color-scheme` so native controls and scrollbars agree with the selected theme.
- Migration review covers default, hover, active, focus-visible, selected, disabled, pending, destructive, and lifecycle states in both themes. Passing the light theme does not imply dark-theme acceptance.

## Adoption boundary

The token entry points are exported through `@taskome/ui`. The Web root imports `web.css`, declares `data-surface="web"`, and selects the explicit light theme. `web.css` imports the shared base layer, so consumers do not import both files separately.

`console.css` is available as a stable package export but remains unimported by `apps/console`. A later Console migration must validate every existing primitive and screen against the component contract above in both themes before replacing the current globals.

## Related design context

- [Frontend visual-language design brief](./DESIGN_BRIEF.md)
- [Frontend information architecture](./INFORMATION_ARCHITECTURE.md)
