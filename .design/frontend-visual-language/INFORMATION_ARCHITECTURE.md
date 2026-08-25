# Information Architecture: XDenovo Web and Taskome Console

## Scope

This information architecture defines two related surfaces:

- the single-page XDenovo marketing site implemented in this design flow; and
- the existing Taskome Console hierarchy that the future Console visual system must support without reorganizing it.

The Web page serves protein-design researchers first and research decision-makers second. It moves from company point of view to product understanding, then offers one action: sign in to Taskome. The Console remains an authenticated product workspace with its current navigation model.

## Site map

### Current Web scope

- XDenovo home `/`
  - Hero and company positioning `#top`
  - The scientific infrastructure problem `#approach`
  - Taskome flagship product `#taskome`
  - Taskome access channels `#access`
  - XDenovo scientific capabilities `#capabilities`
  - Company mission and background `#company`
  - Final sign-in prompt `#sign-in`
  - Contact and legal summary in the footer

The section fragments improve orientation and deep linking. They are not separate pages and do not receive independent canonical URLs.

### External destinations

- Taskome sign in: Console origin plus `/login`
- Taskome documentation: Docs origin plus `/`

The Web application receives the Console and Docs origins from deployment configuration. Components use semantic destinations rather than hard-coded production hosts. Local development points to the existing Console and Docs development servers.

### Reserved future Web routes

Do not create these routes in this flow. Reserve their names so a growing section can become a page without renaming its concept:

- Taskome product page `/products/taskome`
- Company page `/about`
- Contact page `/contact`
- Privacy notice `/privacy`
- Legal notice `/legal`

When internationalization is implemented, localized content moves to explicit locale paths:

- English `/en/...`
- Simplified Chinese `/zh-cn/...`

The unprefixed root becomes a stable locale entry or redirect. The i18n implementation must define redirect and canonical behavior before publishing localized routes.

## Web navigation model

### Primary navigation

The desktop Header contains at most four content destinations:

1. **Taskome** -- scrolls to `#taskome`.
2. **Capabilities** -- scrolls to `#capabilities`.
3. **Company** -- scrolls to `#company`.
4. **Docs** -- opens the Taskome documentation origin.

The XDenovo mark links to `#top` on the current page. It does not duplicate a Home label.

### Primary action

**Sign in** is the only CTA in this version. It links to the Console origin plus `/login` and uses the signal-orange action treatment.

Do not show Get started, Book a demo, Contact sales, or a registration CTA in this flow. The Console login journey can expose account creation according to its own product behavior.

### Secondary navigation

The page has no persistent secondary navigation, tabs, or sidebar. Links inside content can move to `#access`, `#approach`, or the final `#sign-in` section when the relationship is clear.

### Footer navigation

The footer groups destinations by purpose:

- **Product**: Taskome section, Docs, Sign in
- **Company**: Capabilities, Company
- **Contact and legal**: approved company contact details, registration identifiers, and future legal destinations

Do not add social links unless the approved destination is real. Do not preserve placeholder `#` links from the archived site.

### Mobile navigation

On small screens:

- keep the XDenovo mark and Sign in action visible;
- place Taskome, Capabilities, Company, and Docs inside one disclosure menu;
- preserve the same order as desktop;
- move focus into the opened menu and return focus to the trigger when it closes; and
- close the menu after an anchor or external destination is selected.

The mobile menu is a navigation disclosure, not a full-screen marketing panel.

## Web content hierarchy

### 1. Hero: establish XDenovo

1. **Company position** -- State that XDenovo builds AI-native biotech products.
2. **Specific entry point** -- Connect that position to protein-design compute and scientific work.
3. **Taskome identification** -- Name Taskome as the flagship product without explaining every capability.
4. **Sign in** -- Give existing and invited users an immediate route into the product.
5. **Scientific visual** -- Support the argument with a lightweight protein-structure and compute-trace composition.

The Hero does not use a second CTA. Docs remains available in the Header.

### 2. Approach: define the problem

1. **Researcher friction** -- Different scientific programs require separate environments, controls, integrations, and file handling.
2. **Product point of view** -- Curated scientific compute should preserve meaningful controls and reproducible provenance.
3. **Boundary** -- Taskome helps run and inspect compute; it does not decide scientific strategy or claim biological conclusions.

This section earns the transition from company claim to product explanation. It should read as a concise editorial argument rather than a feature grid.

### 3. Taskome: explain the flagship product

1. **Product promise** -- Run, manage, and reproduce protein-design compute in one platform.
2. **Compute model** -- Introduce Tool, Job, Attempt, and Job Output in a sequence that shows provenance.
3. **Research organization** -- Explain how Projects organize Jobs and scientific files without changing identity or execution.
4. **Scientific Utilities** -- Show that viewers and editors work with scientific data without creating compute Jobs.
5. **Privacy and ownership** -- State the launch model of individual accounts and private per-user data where supporting copy needs trust evidence.

Taskome receives the largest share of the page after the Hero. The product model replaces generic claims such as “all-in-one AI platform.”

### 4. Access: show consistent entry points

Present the four Taskome Access Channels as equivalent journeys into the same product concepts:

1. Web App
2. MCP Agent
3. Direct API Client
4. CLI

The built-in Agent Assistant belongs inside the Web App. Do not present it as a fifth channel. Do not imply that the marketing site calls Taskome APIs or shares a Taskome session.

### 5. Capabilities: establish scientific depth

Condense the approved archived service catalog into one editorial section:

- de novo peptide and antibody design;
- PDC and PRC targeting heads;
- antimicrobial peptides;
- cosmetic peptides; and
- custom protein design.

Use grouping, short descriptions, or an annotated index instead of five equal marketing cards. Archived performance, cycle, team, and capability facts may appear when they improve the argument, but they must remain faithful to the approved source wording.

### 6. Company: close the credibility loop

1. **Mission** -- Explain why XDenovo applies AI to peptide and protein design.
2. **Background** -- Use the approved team and institutional background concisely.
3. **Presence** -- Include approved company location or research presence only when it helps a visitor evaluate the company.

This section supports the company identity. It does not become a long corporate timeline on the single-page site.

### 7. Final prompt: provide one next step

Restate Taskome in one short line and offer **Sign in**. Do not introduce a new value proposition or a different conversion action at the end of the page.

### 8. Footer: complete the page

Show the XDenovo identity, concise company description, real destinations, approved contact details, and applicable registration information. Keep long legal and privacy content out of the marketing page body.

## Web user flows

### Understand XDenovo and Taskome

1. A researcher lands on `/` from search, a direct link, or a referral.
2. The Hero identifies XDenovo and Taskome in the first viewport.
3. The researcher reads the Approach section to understand the product point of view.
4. The researcher reaches Taskome and sees the domain model, research organization, and Utilities.
5. The researcher either continues into Access and Capabilities or selects Sign in.
6. Sign in opens the Console `/login` journey.

### Reach technical documentation

1. A technical visitor lands on `/`.
2. The Header exposes Docs without requiring page scrolling or menu exploration on desktop.
3. The visitor opens the Docs origin.
4. Docs owns technical onboarding and reference content. The marketing page does not duplicate it.

### Evaluate scientific credibility

1. A research lead lands on `/`.
2. The lead scans the Hero and Taskome explanation.
3. The lead follows the Capabilities anchor or continues to the capabilities section.
4. The lead reviews the Company section and approved evidence.
5. The lead uses Sign in if they already have access or uses approved footer contact details for company contact.

### Return directly to Taskome

1. An existing user lands on `/`.
2. Sign in remains visible in the Header at every viewport size.
3. The user opens Console `/login` without reading the page.

## Responsive reading order

The DOM order follows the narrative order on every viewport:

1. Hero copy
2. Hero action
3. Hero scientific visual or its text equivalent
4. Approach
5. Taskome
6. Access
7. Capabilities
8. Company
9. Final sign-in prompt
10. Footer

Desktop layouts may place annotations or graphics beside earlier copy, but CSS must not create a reading order that differs from the DOM. Mobile layouts simplify and stack compositions rather than hiding sections.

## Naming conventions

Use the canonical product vocabulary from `CONTEXT.md` in public copy and future Console UI.

| Concept                         | Label in UI       | Notes                                                                              |
| ------------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| Company                         | XDenovo           | Use this capitalization. Treat archived `XDeNovo` spelling as legacy presentation. |
| Product                         | Taskome           | XDenovo's flagship product, not the company name.                                  |
| Curated compute capability      | Tool              | Do not use Model or Task. Qualify an MCP protocol primitive as MCP Tool.           |
| Immutable compute request       | Job               | Do not use Run or Submission for the durable request.                              |
| One execution try               | Attempt           | Do not use Run. A retry creates another Attempt for the same Job.                  |
| Published result file           | Job Output        | Do not use Artifact, Result File, or Output File.                                  |
| Group submission                | Batch             | A group of independent Jobs for one Tool. Do not call it a Pipeline.               |
| Research organizer              | Project           | A private organizing container, not a folder or execution workflow.                |
| Browser scientific capability   | Utility           | A viewer or editor that does not create a Job or Attempt.                          |
| Browser product                 | Web App           | The authenticated Taskome browser application in `apps/console`.                   |
| Public company site             | Marketing site    | The XDenovo site in `apps/web`; do not call it the Web App.                        |
| External agent journey          | MCP Agent         | Distinct from the built-in Agent Assistant.                                        |
| User-controlled API integration | Direct API Client | Distinct from Taskome's CLI.                                                       |
| Built-in assistant              | Agent Assistant   | Part of the Web App, not an Access Channel.                                        |

## Structural component reuse map

| Component                 | Used on                                          | Behavior differences                                                                                        |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Marketing page shell      | `/`                                              | Owns skip link, Header, main landmarks, and footer.                                                         |
| XDenovo mark              | Header, footer                                   | Full-color in the Header; single-color variant where quieter treatment is needed.                           |
| Anchor link               | Header, section content, footer                  | Scrolls within `/`; uses a normal URL fragment so links remain copyable.                                    |
| External destination link | Docs, Sign in                                    | Resolves an application origin plus a stable path. Clearly retains link semantics.                          |
| Section heading           | Approach, Taskome, Access, Capabilities, Company | Keeps a consistent label, headline, and summary hierarchy while allowing different art direction.           |
| Scientific visual frame   | Hero, Taskome                                    | Uses a lightweight two-dimensional implementation now and preserves a future Three.js replacement boundary. |
| Sign-in action            | Header, Hero, final prompt                       | Same destination and label; scale and surrounding copy may differ.                                          |
| Editorial index           | Access, Capabilities                             | Reuses numbered or annotated structure without turning every item into a card.                              |

## Content growth plan

- **Taskome** grows first. When the single section can no longer explain the product without crowding the homepage, promote it to `/products/taskome` and keep the homepage section as a summary.
- **Company** becomes `/about` when team, history, locations, or governance content needs independent maintenance.
- **Contact** becomes `/contact` when XDenovo introduces a form, routing by inquiry type, or multiple contact destinations.
- **Legal and privacy** become dedicated routes before long-form notices need to be published. Do not place long notices inside modals or disclosures on the homepage.
- **Capabilities** may become an index only when XDenovo has enough durable content to support meaningful detail pages. Do not create thin pages for every archived service name.
- **News, blog, careers, and pricing** have no reserved place in the current navigation. Add them only with owned content and a clear user job.

Promoting a section to a page keeps its current name, updates the Header destination, and preserves the old fragment as a summary or redirect target where useful.

## Web URL strategy

- Current canonical page: `/`
- Current deep links: `/#taskome`, `/#capabilities`, `/#company`, and other section fragments
- Current dynamic segments: none
- Current query parameters: none
- External application paths: Console `/login`; Docs `/`
- Future English pattern: `/en/<section-or-page>`
- Future Simplified Chinese pattern: `/zh-cn/<section-or-page>`

Fragments do not create separate SEO documents. Tracking parameters, if added later, must not change canonical URLs or page content.

## Console information architecture

This flow preserves the current Console model:

- Overview `/`
- Compute
  - Tools: planned route
  - Jobs: planned route
  - Batches: planned route
- Workspace
  - Projects `/projects`
  - Files: planned route
  - Utilities
    - Structure Viewer `/utilities/structure-viewer`
    - MSA Viewer: planned route
    - Molecule Drawer: planned route
- Settings `/settings`
  - General `/settings`
  - Profile `/settings/profile`
  - Security `/settings/security`
  - API Keys `/settings/api-keys`

### Console navigation model

- **Primary navigation**: A persistent, collapsible sidebar separates Compute from Workspace.
- **Overview**: The default authenticated entry point, not a substitute for primary work areas.
- **Contextual navigation**: Page headers, breadcrumbs, tabs, and local actions describe the current Tool, Job, Attempt, Batch, Project, file, or Utility context.
- **Utility navigation**: Search, appearance, account, inbox when real, and Settings stay outside the domain hierarchy.
- **Mobile navigation**: The sidebar becomes a temporary sheet. Product work remains usable, but scientific viewers and wide data sets may require purpose-built mobile adaptations.

### Console content priority

The most frequent long-term work centers on discovering a Tool, submitting or reopening a Job, inspecting Attempts and Job Outputs, and moving between related Projects, files, and Utilities. Overview helps users resume work; it does not own the underlying records.

The future visual specification must support this priority through compact navigation, explicit lifecycle state, durable identifiers, and content-first Utility workspaces. It must not rearrange the Console route hierarchy during this flow.

## Related design context

- [Frontend visual-language design brief](./DESIGN_BRIEF.md)
- [Taskome product vision](../../docs/product/vision.md)
- [Taskome domain vocabulary](../../CONTEXT.md)
- [XDenovo marketing-site boundary](../../apps/web/README.md)
- [Taskome Console boundary](../../apps/console/README.md)
