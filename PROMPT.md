# Claude Code Build Prompt — Account Command Center

> **How to use:** Create an empty folder, save this file in it as `PROMPT.md`, open Claude Code in that folder, and send:
> `Read PROMPT.md in full. Start with Phase 0, show me the plan, then build Phases 1–4. Stop after each phase, run all checks, and summarize before moving on.`

---

## 1. Role & Mission

You are a senior full-stack engineer and product designer. Build **Account Command Center (ACC)**: a polished, scalable, local-first sales intelligence dashboard for an **Associate Client Director at AHEAD**, an enterprise technology consulting and solutions provider (AI infrastructure, modern data center, cloud, data & analytics, security, automation/platform engineering, enterprise service management, managed services, and the AHEAD Foundry integration facility).

The user manages a portfolio of enterprise accounts. ACC should let them:

1. Understand every account at a glance (account intelligence)
2. See what is changing at those accounts right now (live signals)
3. Plan and track pipeline (opportunities)
4. Plan and run outreach (demand gen strategies)
5. Produce executive-ready summaries (export controls)
6. Later: show customers what their future data center will look like, feel like, and how it runs (data center sandbox)

**Build the core dashboard first and make it excellent.** The sandbox and advanced exports are add-ons. Design the architecture so they plug in cleanly, but build only stubs for them in this pass.

---

## 2. Hard Rules: Data & Confidentiality (non-negotiable)

- **No internal or confidential data.** Do not ask for, expect, or include any AHEAD internal data, CRM exports, pricing, margins, customer contracts, or non-public customer information.
- **Seed data is fictional.** Generate realistic synthetic data with invented company names (e.g., "Halvorsen Mutual," "Crestline Regional Health," "Aurelian Logistics"). Never use real company names in seed data. Add a visible `DEMO DATA` badge whenever synthetic data is showing.
- **Live data comes only from public sources** (Section 6). The user can add real target accounts by public name/domain/ticker, and those accounts are enriched only from public sources.
- **No third-party brand assets.** Don't use AHEAD, OEM, or customer logos. Use a neutral, configurable theme with a placeholder wordmark. All branding lives in one theme config file.
- **Local-first and private.** Run fully on localhost. No telemetry or analytics, and no external calls except the public data fetchers the user enables. API keys go in `.env.local` (git-ignored). Ship an `.env.example`.
- **Integration-ready, not integrated.** Build a clean data-adapter interface so CRM, marketing-automation, or internal systems can be connected later *only if the user's company approves them*. Do not build any of those connectors now.

---

## 3. Tech Stack

Use these unless you have a strong reason to change one. If you do, say why before changing it.

| Layer | Choice |
|---|---|
| Framework | Next.js (latest stable, App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui + Radix primitives + lucide-react icons |
| Charts | Apache ECharts (via `echarts-for-react`) for dense/interactive charts; Recharts acceptable for simple ones. Pick one primary library and wrap it. |
| Layout | `react-grid-layout` for a user-customizable widget grid |
| State / data | TanStack Query (server state) + Zustand (UI state) |
| Database | Prisma ORM + SQLite now; schema must be Postgres-compatible for later |
| Live updates | Background job runner (node-cron or a simple in-process scheduler) + Server-Sent Events to push new signals to the UI |
| Search | Command palette (`cmdk`) + full-text search across accounts, signals, opps, notes |
| Validation | Zod for every external payload and form |
| Testing | Vitest (unit), Playwright (e2e + screenshot checks) |
| Exports (stub now) | Playwright → PDF; `pptxgenjs` → PPTX; Markdown |
| Sandbox (stub now) | react-three-fiber + drei for 3D; plain SVG for 2D rack elevations |

---

## 4. Architecture: Built to Scale

### 4.1 Module (widget) registry: the core extensibility pattern
Every feature is a **module** that registers itself. Adding a module must never require editing the dashboard shell.

```ts
// src/modules/types.ts
export interface AccModule {
  id: string;                     // "account-intel", "signals-feed", ...
  title: string;
  icon: LucideIcon;
  category: "intel" | "pipeline" | "demand-gen" | "exports" | "sandbox" | "addon";
  routes?: ModuleRoute[];         // full-page views
  widgets?: WidgetDefinition[];   // dashboard tiles (sizes: sm/md/lg/xl)
  exportSections?: ExportSectionDefinition[]; // what this module can contribute to an executive summary
  dataAdapters?: DataAdapter[];   // where its data comes from
  settingsSchema?: ZodSchema;     // module settings UI auto-generated from schema
  featureFlag?: string;           // modules can be toggled on/off
}
```

- `src/modules/<module-id>/` holds each module's components, hooks, adapters, and tests.
- `src/modules/registry.ts` auto-collects modules. A sidebar, widget picker, export builder, and settings page are all generated from the registry.
- **Every module must declare `exportSections`.** This is what lets the executive-summary exporter scale automatically as modules are added.

### 4.2 Data adapter layer
```ts
export interface DataAdapter<T> {
  id: string;                     // "sec-edgar", "rss-news", "seed", "crm-placeholder"
  kind: "public" | "seed" | "manual" | "private-future";
  fetch(params): Promise<T[]>;
  schedule?: string;              // cron for live sources
  normalize(raw): T;              // to internal schema, validated with Zod
}
```
Ship these: `seed`, `manual` (user-entered), and the public adapters in Section 6. Ship a `private-future` placeholder that throws a clear "not configured — requires company approval" error.

### 4.3 Data model (Prisma). Start here and extend.
- `Account`: name, domain, ticker?, industry, sub-industry, HQ, employee band, revenue band, tier (Strategic/Growth/Maintain), owner notes, health score, whitespace score, `isDemo`
- `Contact`: public-role personas only (title, function, seniority, buying role: Economic Buyer / Champion / Technical / Influencer / Blocker), with no personal contact details scraped
- `Initiative`: inferred or stated strategic initiatives (e.g., "GPU cluster build-out," "data center consolidation," "cloud cost reduction"), with source and confidence
- `TechStackHypothesis`: category, vendor/technology, evidence (job post, filing, news), confidence
- `Signal`: account, type (news, filing, earnings, exec change, hiring, M&A, funding, partnership, regulatory, outage/incident, expansion), title, summary, url, publishedAt, source, practice tags, relevance score, read/starred/dismissed
- `Opportunity`: account, name, practice area, stage, amount, close date, probability, next step, MEDDPICC fields, partner/OEM involvement, competitors, risk flags, stage history
- `Play`: demand-gen play library entry (Section 5.5)
- `Campaign` / `Touch`: planned and completed outreach (channel, persona, message angle, date, outcome)
- `Event`: conferences, webinars, partner events, briefings
- `Note`: rich-text notes linked to any entity
- `ExportTemplate`, `ExportJob`
- `SandboxScenario` (stub table for later)
- `ActivityLog`: everything the user changes, for a "what changed this week" view

### 4.4 Performance & scale targets
- Seed **150 accounts, 600 opportunities, 15,000 signals, 2,000 touches** and keep the UI fast with that load: virtualized tables and lists, server-side pagination/filtering, and memoized charts.
- Dashboard first paint < 1.5s locally; table interactions < 100ms perceived.
- All lists support filter, sort, saved views, and CSV export.

---

## 5. Core Modules (build fully in this pass)

### 5.1 Command Home (portfolio dashboard)
- Customizable widget grid (drag, resize, add/remove, save layouts; at least 3 saved layouts like "Monday Pipeline Review," "Account Prep," "Exec Readout").
- KPI strip: pipeline total, weighted pipeline, # active opps, win rate, avg deal cycle, coverage ratio vs a user-set target, new high-relevance signals (24h/7d).
- Widgets: pipeline by stage (funnel), pipeline by practice area (bar), forecast vs target (line/area), account health heatmap (accounts × health dimensions), top movers this week, signal feed (compact), upcoming close dates, stalled deals (no stage change in N days), next-best-actions list.
- "What changed since you last looked" panel built from `ActivityLog` + new signals.

### 5.2 Account 360 (account intelligence)
One page per account, with tabs:
- **Overview:** firmographics, tier, health score breakdown, whitespace score, key initiatives, last/next touch, open opps summary.
- **Intelligence:** strategic initiatives with evidence and confidence, tech stack hypotheses, likely pain points mapped to AHEAD practice areas, and an "Opening angles" list of conversation starters with linked evidence.
- **Buying Committee:** persona map (org-chart style graph) with buying roles, coverage gaps highlighted ("No Economic Buyer identified").
- **Whitespace Map:** grid of AHEAD practice areas × account (Not engaged / Exploring / Active opp / Delivered), click to create opp or play.
- **Signals:** filtered live feed for this account.
- **Opportunities**, **Activity**, **Notes**.
- **Account Plan:** structured plan (objectives, strategies, actions, owners, dates) that feeds the exporter.
- Health score and whitespace score are transparent: show the formula and inputs, and let the user adjust weights in settings.

### 5.3 Live Signals
- Unified real-time feed (SSE) across all accounts, with filters for account, type, practice tag, source, date, and relevance.
- Each signal is auto-tagged to practice areas using a transparent keyword/rules engine (editable in settings). Examples: "GPU," "AI factory," "inference" → AI Infrastructure; "data center consolidation," "colocation," "liquid cooling" → Modern Data Center; "ransomware," "breach," "zero trust" → Security; "ServiceNow," "ITSM" → Enterprise Service Management; "FinOps," "cloud spend" → Cloud.
- Relevance score = recency × source weight × practice match × account tier. Show the breakdown on hover.
- Actions on a signal: star, dismiss, add note, **convert to play/touch**, **convert to opportunity**, add to the next exec summary.
- Alerting: in-app notification center + optional desktop notifications for signals above a threshold.
- Daily/weekly digest view.

### 5.4 Opportunities
- Views: Kanban by stage (drag to move, which logs stage history), dense table with inline edit, and forecast view (commit / best case / pipeline by month and quarter).
- MEDDPICC panel on each opp with a completeness score and red flags.
- Partner/OEM involvement field (generic vendor list, user-editable) and competitor tracking.
- Deal risk heuristics: stalled stage, close date pushed ≥2 times, missing Economic Buyer, low MEDDPICC score.
- Charts: stage conversion, velocity, aging, and pipeline creation trend.

### 5.5 Demand Gen Strategy
- **Play Library:** reusable plays, each with a name, practice area, target personas, trigger signals, value hypothesis, talk track outline, suggested sequence (channel + day offset), assets needed, and success metrics. Seed ~15 generic plays aligned to the practice areas, e.g.:
  - AI infrastructure readiness assessment
  - Data center consolidation / modernization
  - Pre-integrated rack delivery (integration-facility value story)
  - Cloud cost optimization / FinOps
  - Security posture and ransomware resilience
  - ServiceNow / ESM expansion
  - Platform engineering & automation
  - Executive briefing / roundtable invite
  - Partner-co-sell event follow-up
- **Play Recommender:** for any account, rank plays using initiatives + signals + whitespace + buying-committee gaps, and explain *why* each play is suggested.
- **Campaign Planner:** calendar and timeline of touches by account and persona; drag to reschedule.
- **Message Builder:** template-based outreach drafts (email, LinkedIn note, call opener) that fill in account context and evidence. Pure templating for now; leave an `AiProvider` interface for a future LLM add-on.
- **Events:** track conferences and partner events, which accounts to invite, and follow-up status.
- Metrics: touches per account, persona coverage, play effectiveness (touch → meeting → opp).

### 5.6 Executive Summary & Export Controls (build the framework now; full polish is an add-on)
- **Export Builder:** choose scope (one account, a set of accounts, or the full portfolio), choose sections (assembled from every module's `exportSections`), reorder them, pick a template, then preview live.
- **Controls:**
  - Audience mode: `Internal` vs `Customer-facing`. Customer-facing auto-hides internal-only fields such as deal amounts, probabilities, risk flags, competitor notes, and internal notes.
  - Per-field redaction toggles and a "redaction preview" highlight
  - Watermark (e.g., "DRAFT," "INTERNAL ONLY"), date stamp, version number
  - Chart rendering to high-res images for export
- Output formats for this pass: **PDF** (via Playwright print of a dedicated print route) and **Markdown**. Stub **PPTX** behind the same interface with a working minimal implementation (title + one slide per section).
- Keep an export history with re-run capability.

### 5.7 Data Center Sandbox (STUB ONLY in this pass)
Create the module, route, nav entry, data model, and interfaces. Show a polished "Coming next" landing page with a static 2D rack-elevation preview. Define these interfaces now so the add-on drops in:
- `SandboxScenario` (sites, rooms, rows, racks, devices, power, cooling, network)
- `ComponentLibrary` (generic, illustrative device profiles: GPU server, CPU server, storage array, top-of-rack switch, spine switch, PDU, CDU; specs labeled "illustrative, not vendor-certified")
- `SimulationEngine` interface (power draw, heat load, cooling capacity, utilization, failure scenarios)
- `exportSections` for sandbox screenshots and capacity tables

### 5.8 Settings & Admin
- Theme (light/dark/system, accent color, wordmark text), practice-area taxonomy editor, tagging-rules editor, scoring weights, data source toggles + API key status, feature flags per module, import/export of all data as JSON (backup/restore), and "Reset demo data."
- Bulk import of the user's own target-account list via CSV (name, domain, ticker), with field mapping UI.

---

## 6. Live Data: Public Sources Only

Implement these adapters, each toggleable, rate-limited, cached, and deduplicated (by URL + title hash):

1. **News RSS:** Google News RSS search per account name, plus user-added RSS feeds (company newsrooms, trade press).
2. **SEC EDGAR** (for public companies with tickers): recent filings (8-K, 10-K, 10-Q) via the official EDGAR JSON endpoints. EDGAR requires a descriptive User-Agent with contact info. Read it from `.env.local` (`SEC_USER_AGENT`) and never hardcode it.
3. **Public job boards (hiring signals):** Greenhouse and Lever public job-board JSON endpoints when the user provides the company's board slug. Classify postings into tech-stack and initiative evidence (e.g., "hiring 6 GPU/HPC engineers" → AI infrastructure initiative).
4. **GDELT** (optional): broader news/event coverage.
5. **Manual signal entry:** paste a URL plus notes.

Requirements: backoff on errors, a per-source health indicator in Settings, a "Fetch now" button, and a scheduler default of every 30 minutes (configurable). Everything still works offline using seed data.

---

## 7. Design & UX Bar

- Feel: calm, dense, executive-grade, similar to a high-end analytics product. Not a template. Clean typography (Inter or Geist), generous but efficient spacing, a restrained palette with one accent, and consistent 8-pt spacing.
- First-class **dark mode** and **light mode**. Charts read correctly in both.
- Fully keyboard navigable; `⌘K` command palette for jump-to-account, create opp, add note, open export builder.
- WCAG AA contrast, visible focus states, aria labels on interactive charts, and data tables as accessible alternatives to charts.
- Responsive: full experience on laptop and large monitor; read-mostly experience on tablet/phone.
- Empty, loading (skeletons), and error states designed for every view.
- A **Presentation Mode** toggle that hides internal-only data and enlarges charts, for screen-sharing with customers.
- One chart wrapper component with a shared color system, so every chart looks like part of one product.

---

## 8. Quality, Testing & Docs

- TypeScript strict, ESLint + Prettier, no `any` without a comment.
- Unit tests for scoring, tagging rules, adapters' `normalize`, MEDDPICC scoring, redaction logic, and the module registry.
- Playwright e2e: load dashboard, customize layout, open Account 360, move an opp across stages, convert a signal to a play, generate a customer-facing PDF and verify redacted fields are absent.
- Playwright screenshot pass of every main page in light and dark mode. Review the screenshots yourself and fix visual issues before declaring a phase done.
- Seed script: `npm run seed` (fictional data, deterministic with a fixed random seed).
- Write `README.md` (setup, scripts, architecture, how to add a module) and `CLAUDE.md` (conventions, folder map, rules from Section 2, so future sessions follow them).
- Write `docs/ADDING_A_MODULE.md` with a worked example.

---

## 9. Build Phases

Work in this order. **At the end of each phase:** run typecheck, lint, tests, and the screenshot pass, fix failures, update `CLAUDE.md`, commit with a clear message, and give me a short summary plus anything you need from me.

- **Phase 0, Plan:** Restate the goals, list assumptions, propose the folder structure and Prisma schema, and flag any concerns. Wait for my approval.
- **Phase 1, Foundation:** Scaffold, design system, theme, app shell (sidebar, top bar, command palette, notification center), module registry, Prisma schema, deterministic seed data, Settings skeleton.
- **Phase 2, Intelligence & Pipeline:** Command Home with widget grid and saved layouts, Account 360 (all tabs), Opportunities (Kanban, table, forecast).
- **Phase 3, Signals & Demand Gen:** Public data adapters, scheduler, SSE live feed, tagging and scoring engine, Play Library, Play Recommender, Campaign Planner, Message Builder, Events.
- **Phase 4, Exports & Polish:** Export Builder with audience modes, redaction, watermarking, PDF + Markdown + minimal PPTX; Sandbox stub; Presentation Mode; performance pass at full seed scale; accessibility pass; final screenshot review; complete docs.

**Definition of done for this build:** All Phase 1–4 items work with demo data and at least one real public account added via CSV. All tests pass. Screenshots look production-quality in both themes. A new module can be added by creating one folder.

---

## 10. Planned Add-ons (do NOT build now; keep the architecture ready for them)

1. **Data Center Sandbox (full):** 2D floor plan + rack elevation editor, 3D walkthrough (react-three-fiber), drag-and-drop component library, power/cooling/PUE calculators (air vs direct-to-chip liquid), capacity growth over time, failure and maintenance simulations, a mock "operations console" with simulated live telemetry (utilization, temps, power), before/after comparison, customer-facing guided tour mode, and export of views into the executive summary.
2. **Advanced exports:** branded PPTX templates, multi-account QBR packs, scheduled digests.
3. **AI assistant add-on:** pluggable `AiProvider` for account briefs, signal summarization, message drafting, and "prep me for this meeting." Off by default and fed only data the user chooses to send.
4. **Approved integrations:** CRM / marketing automation / calendar via the `private-future` adapter slot, only after company approval.
5. **Multi-user & hosting:** auth, Postgres, role-based field visibility, and deployment to a company-approved environment.

---

## 11. Working Style

- Ask before making architectural changes that diverge from this spec.
- Prefer small, composable components; no file over ~300 lines without good reason.
- Never invent "facts" about real companies. Every intelligence item on a real account must link to its public source or be marked as a user-entered hypothesis.
- When something is ambiguous, choose the option that keeps the system modular, document the choice in `CLAUDE.md`, and keep going.