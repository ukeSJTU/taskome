# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

`apps/web` serves two distinct audiences under one Next.js app:

- **Internal tool platform** (`(application)` document tree): XDenovo's own internal teams doing binder/de novo protein design work. The audience is mixed — computational/ML researchers comfortable with a tool's real configuration surface, alongside wet-lab scientists who may need more guidance. Accounts are flat and individual (no team-scoped sharing/visibility yet). "Internal only, no billing" is a v1 implementation-scope constraint on _this_ surface specifically (deliberately avoiding over-building account/billing infrastructure this platform doesn't need yet) — it does not describe the company or the public website below.
- **Public corporate website and identity flows** (`(localized)/[locale]` document tree): genuinely public-facing in Simplified Chinese and English. Primary visitors are biology-field professionals and researchers (the same kind of user the tool platform itself serves — computational biology, wet-lab, pharma R&D) evaluating XDenovo's actual technology and credibility. Secondary visitors are broader potential research/pharma partners, collaborators, and the AI4Bio-interested public.

## Product Purpose

Two independent surfaces sharing one app:

1. **Tool platform** — a GPU-backed compute platform that puts XDenovo's internal protein-design tools behind a single reachable interface, exposed identically over a Web UI, MCP, and REST. No fixed tool list — the current and planned roster is tracked in `docs/product/roadmap.md`, not restated here, so this document doesn't go stale every time a tool ships. Success is a researcher or agent running a real job with the tool's actual config surface, without needing direct server access.
2. **Public website** — communicates XDenovo's AI4Bio positioning outward. Success is a visitor understanding what XDenovo does and why it's differentiated.

## Positioning

- **Tool platform**: modeled on two references, each contributing a different piece — tamarind.bio's GPU-backed compute tools behind one platform, reached from a web UI, combined with subseq.bio's power-user posture (expose a tool's real configuration surface, not a no-code abstraction). A neighboring "no-code" wrapper product could not truthfully copy the power-user parameter surface; a bare internal script runner could not truthfully copy the unified Web/MCP/REST access model.
- **Public website**: positions XDeNovo within AI4Bio (AI-native biotech / de novo protein design) through eight complete marketing, company, contact, legal, and privacy pages. The hand-maintained `zh-CN` and English catalogs cover the public site and logged-out identity flows; Chinese is the default URL language and English uses `/en`.

## Operating Context

- **Access Channels** (ADR-0002): Web App uses REST through `apps/web`'s own BFF API routes; MCP Agents use MCP directly against `apps/gateway`; Direct API Clients use REST directly against `apps/gateway`. Browser code never bypasses the BFF. A CLI is a planned fourth channel (not yet built) that reuses the Direct API Client's REST + Personal API Key path — see `docs/product/roadmap.md` milestone 3.
- **Domain terms** (root `CONTEXT.md`): Task, Job, Task Server, Gateway, Principal, Personal API Key, Input File. "taskome" = Task + -ome.
- **Data ownership** (ADR-0001): `apps/web` owns the auth Postgres schema; `apps/gateway` owns jobs and input files. Cross-service access goes through gateway's REST API, never direct SQL.
- **Task Servers**: each tool ships as its own `apps/task-<name>` uv project built on `packages/task-kit` (ADR-0003), which generates matching REST + MCP wiring from one `ComputeAdapter` per Task. `apps/task-fpocket` (binding pocket detection, wrapping `fpocket`) is the first Task Server — currently a skeleton, not yet calling `build_task_server()` (see `docs/product/roadmap.md`).
- **Auth**: better-auth (`packages/auth`), consumed via `apps/web/src/lib/auth-client.ts`. Plugins: personal API keys (named, revocable), JWT (short-lived session tokens for BFF→Gateway calls), two-factor auth (issuer "taskome"). Also handles OAuth consent and an OAuth authorization server `.well-known` endpoint for MCP Agent auth.
- **Routes**: `(localized)/[locale]` contains the public site, login/signup, OAuth consent, and two-factor flows; `(application)` contains the English-only authenticated dashboard, account/API keys, and API reference.

## Capabilities and Constraints

- Each Task's MCP and REST parameters are a curated subset of the underlying tool's real config, designed per tool (not a full passthrough), including vendored-code changes where needed. No CLI yet — see Access Channels above.
- Both MCP and REST are required for every Task — neither ships alone as "done."
- Job chaining (piping one Job's output into the next Job's input) is explicitly out of scope for now; it's on the roadmap and not designed around yet.
- No fixed tool catalog boundary — current and planned tools, with status, are tracked in `docs/product/roadmap.md`, extended opportunistically.
- No team-scoped sharing/visibility yet (flat individual accounts); storage layer is ownership-agnostic so this can land later without a storage migration (ADR-0001).
- `apps/docs` is a separate static public content site with no Gateway access — out of scope for `apps/web`.

## Brand Commitments

- Product/company name: "taskome" (page title and OTel service name) is the internal platform's name. The public-facing company brand name is confirmed as **XDeNovo** (matches the old site's legal name, Shanghai XDeNovo Biotechnology Co., Ltd.) — use "XDeNovo" casing on the public website, not "XDenovo."
- No logo or brand asset files exist yet in `apps/web` (no `public/` directory beyond the default `favicon.ico`).

## Evidence on Hand

- The public-site copy is implemented from the following company facts, originally captured in `references/old-website` and since shaped for the current site:
    - **Company**: XDeNovo / 纽肽生物 (Shanghai XDeNovo Biotechnology Co., Ltd.), founded 2025.
    - **Mission**: accelerate drug development through AI-designed novel peptides, addressing difficult-to-drug targets and unmet clinical needs.
    - **Team**: core members from David Baker Laboratory and Shanghai Jiao Tong University; combines peptide engineering expertise with AI.
    - **Products** (previous framing, predates this repo's actual tool roster — see `docs/product/roadmap.md`): de novo peptide/antibody design, PDC/PRC drug targeting heads, antimicrobial peptides, cosmetic peptides, industrial enzymes, custom protein design.
    - **Platform validation cases**: metabolic diseases, tumor immunity, neurodegenerative diseases, autoimmune diseases, cardiovascular diseases — each with a stated affinity/specificity claim from internal experimental data.
    - **Locations**: HQ Shanghai (Minhang District); R&D presence in Shanghai, Beijing, Hong Kong, Seattle.
    - **Industry timeline** (2018 AlphaFold → 2021 AlphaFold2 → 2022 first AI-antibody in clinical trials → 2023 RFdiffusion → 2024 Nobel Prize in Chemistry for computational protein design → 2025 company founded).
    - These are real historical facts, not synthetic placeholders — reusable as real content. Confirm with the user before publishing anything time-sensitive (team roster, locations, specific numeric claims) in case it has changed since the old site was written.
- No screenshots, demos, or sample job data beyond a placeholder `data.json` in the dashboard route.
- No logo or brand asset files exist in `apps/web` (the old site's `public/NewPeptide_logo.png` predates the current name and is not to be reused as an asset).

## Product Principles

- Expose real tool configuration, not a no-code abstraction — power users over convenience defaults.
- Every Task is reachable identically through Web, MCP, and REST; no channel is a second-class citizen.
- Internal tool, not a commercial product — no billing, no external-customer assumptions baked into the platform.
- Durable architecture over roadmap-shaped shortcuts: features not yet built (team sharing, job chaining) stay behind stable boundaries rather than leaking into today's contracts.

## Accessibility & Inclusion

WCAG 2.1 AA is the required baseline for both the internal tool platform and the public website.
