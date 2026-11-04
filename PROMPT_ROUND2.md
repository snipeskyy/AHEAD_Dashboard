# Claude Code Build Prompt — Account Command Center, Round 2
## Real accounts, public-data enrichment, and efficiency upgrades

> **How to use:** Save this file in the root of your existing Account Command Center project as `PROMPT_ROUND2.md`. Open Claude Code there and send:
> `Read CLAUDE.md, then read PROMPT_ROUND2.md in full. Do Phase 5 step 1 (the audit) and report back before changing anything.`
>
> Every phase ends with a stop so you can review it. If you don't want a recommendation from Phase 8 or 9, delete that bullet before you start.

---

## 0. Context for Claude Code

This project is **Account Command Center (ACC)**, a local-first sales intelligence dashboard for an Associate Client Director at AHEAD (an enterprise technology consulting and solutions provider). Phases 0–4 from `PROMPT.md` are complete: app shell, module registry, Command Home, Account 360, Opportunities, Live Signals, Demand Gen, the export framework, and the Sandbox stub.

This round has three goals:
1. **Go live with real data.** Remove all demo data so the user can import the accounts they actually cover.
2. **One-click public enrichment.** From the Accounts tab and each Account 360 page, fetch public information to fill in the account. The user fills any gaps by hand.
3. **Efficiency.** Make ACC the fastest way for the user, and later their team, to prepare, prioritize, and act.

### Rules carried over from Round 1 (still non-negotiable)
- No AHEAD-internal or confidential data is built in or expected. The user enters their own account knowledge by hand. That is their choice and stays local.
- Enrichment uses **public sources only**, and only through official APIs, public feeds, or a company's own public website. Respect each source's terms of use, rate limits, and `robots.txt`.
- **Do not scrape LinkedIn, ZoomInfo, or any other login-walled or ToS-restricted site.** Do not collect personal contact details (personal emails, phone numbers, home addresses) for individuals. Public executive names and titles from official filings or a company's own website are fine.
- Every fetched value records its **provenance**: source, URL, fetched-at time, and confidence. Nothing appears as fact without a source link.
- Local-first. No telemetry. API keys live in `.env.local`.

---

## Phase 5: Clean slate and real-account import

### 5.1 Audit first (report back, don't change anything yet)
- Compare the codebase against `PROMPT.md` and `CLAUDE.md`. List what's complete, partial, or missing, and any tech debt or failing checks.
- List everywhere demo data is created, referenced, or assumed: seed scripts, `isDemo` flags, hardcoded fixtures, demo badges, and charts or tests that depend on seed volumes.
- Propose the removal plan and wait for approval.

### 5.2 Remove demo data
- Before purging, **write an automatic JSON backup** to `backups/pre-purge-<timestamp>.json`.
- Purge every demo record from the database: accounts, opportunities, signals, touches, campaigns, events, notes, activity log, and export history.
- Remove seeding from the default dev/start flow. Move synthetic data to `tests/fixtures/` and use it **only** for tests, against a separate test database (`DATABASE_URL_TEST`). Running the app must never write demo data again.
- Remove the demo badge from the UI, but keep the `isDemo` column (default `false`) so a demo can never mix with real data silently.
- Keep the **Play Library** as starter content, relabeled "Starter Plays," because it's methodology, not account data. Add an option to clear it.
- Add a `npm run db:reset` command that asks for confirmation and makes a backup before resetting.

### 5.3 First-run experience and empty states
- On first run with an empty database, show an onboarding flow: **Import accounts → Resolve identities → Enrich → Review**.
- Every widget, chart, and table gets a designed empty state with a clear call to action (e.g., "No opportunities yet. Add one or import from CSV"). No broken charts with zero data.
- KPI targets (pipeline target, coverage ratio, cadence rules) start blank, with a prompt to set them in Settings.

### 5.4 Import wizard (accounts first, then everything else)
- Inputs: **CSV, XLSX, or a pasted list** (one company per line, optionally with a domain).
- Downloadable import templates for Accounts, Contacts, Opportunities, Notes, and Partner Reps.
- Column-mapping UI with auto-match, saved mappings, preview of the first 20 rows, and Zod validation with row-level error reporting.
- **De-duplication:** match on domain first, then on normalized legal name. Show proposed merges and let the user choose merge, skip, or create.
- After import, offer **"Enrich all imported accounts now"** to start the bulk enrichment queue (Phase 6).
- Every import is logged and **undoable** (roll back an import batch).

**Phase 5 done when:** the database is empty of demo data, the app runs cleanly with zero records, tests pass against fixtures in the test DB, and the user can import a real account list with dedupe and undo.

---

## Phase 6: Public-data enrichment engine

### 6.1 Architecture
```ts
// Step 1: identity resolution. Figure out exactly which entity this account is.
interface AccountIdentity {
  legalName?: string; domain?: string; ticker?: string; cik?: string;   // SEC
  lei?: string;            // GLEIF
  wikidataId?: string;     // e.g. Q12345
  jobBoard?: { provider: "greenhouse" | "lever" | "ashby" | "smartrecruiters"; slug: string };
  newsroomRss?: string; irRss?: string;
  confirmedByUser: boolean;
}

// Step 2: enrichers. Each one is a self-contained plugin that proposes field values.
interface Enricher {
  id: string;                         // "sec-edgar", "gleif", "wikidata", ...
  requires: (keyof AccountIdentity)[];
  produces: string[];                 // field paths it can fill
  ttl: Duration;                      // how long results stay fresh
  run(identity, ctx): Promise<FieldProposal[]>;
}

interface FieldProposal {
  field: string;                      // e.g. "firmographics.employeeCount"
  value: unknown;
  source: string; sourceUrl: string; fetchedAt: Date;
  confidence: "high" | "medium" | "low";
  evidenceSnippet?: string;           // short excerpt that supports the value
}
```
- Enrichers register through the same module-registry pattern, so new sources can be added by dropping in a folder.
- All fetches run **server-side** (Next.js route handlers or the job runner). Never from the browser.
- A shared HTTP client handles rate limiting per source, retry with backoff, caching (raw responses stored with TTL), a descriptive User-Agent from `.env.local`, and per-source health status.
- **Check each source's current API documentation and terms at build time.** If an endpoint has changed or now requires a key, adapt it and note the change in `CLAUDE.md`.

### 6.2 Identity resolution (runs before enrichment)
- Given a name and/or domain, search candidates in parallel: the SEC company ticker list, GLEIF legal-entity search, Wikidata entity search, and the company's own website (to confirm the domain).
- Show a **disambiguation dialog** when there's more than one plausible match (e.g., "Acme Corp (NYSE: ACM, Dallas)" vs "Acme Corp Ltd (UK)"), with key facts to help the user choose. Store the confirmed identifiers.
- Auto-detect from the company's website: careers page → job-board provider and slug; newsroom or investor-relations page → RSS feeds.
- Allow manual override of every identifier.

### 6.3 Enrichers to build (public only)

| Enricher | Source | Fills |
|---|---|---|
| **Website profile** | Company homepage, `/about`, schema.org Organization JSON-LD, meta/OpenGraph tags | Description, HQ address, social links, newsroom/careers/IR URLs |
| **SEC EDGAR** (public companies) | `company_tickers.json`, submissions API, XBRL company facts | CIK, SIC industry, addresses, **fiscal year end**, revenue, net income, **capex** (`PaymentsToAcquirePropertyPlantAndEquipment`) with multi-year trend, recent filings list |
| **10-K / 10-Q text mining** | Filing documents from EDGAR | Rules-based extraction of initiative evidence from Item 1 (Business), 1A (Risk Factors), 1C (Cybersecurity), and MD&A: AI, data center, cloud migration, consolidation, cost reduction, security, ERP, M&A. Store short evidence snippets with section references, never whole sections. |
| **8-K monitor** | EDGAR | Executive changes (Item 5.02), M&A (Items 1.01/2.01), **material cybersecurity incidents (Item 1.05)** → high-priority signals |
| **Proxy (DEF 14A) / 10-K officers** | EDGAR | Named executive officers and titles → Buying Committee suggestions (name + title + source only) |
| **GLEIF** | GLEIF LEI API | Legal name, registered and HQ addresses, **parent / ultimate parent / subsidiaries** → corporate hierarchy view |
| **Wikidata / Wikipedia** | Wikidata SPARQL, Wikipedia REST summary | Founded, industry, employee count, revenue, CEO, subsidiaries, short summary |
| **Hiring signals** | Greenhouse / Lever / Ashby / SmartRecruiters public job-board APIs | Open roles by function and location, hiring-trend history, tech keywords in postings → tech-stack hypotheses and initiative evidence (e.g., "8 open GPU/HPC/platform engineering roles") |
| **DNS footprint** | Public DNS (MX, TXT/SPF, domain-verification records) | Tech-stack hypotheses: email platform (Microsoft 365 / Google Workspace), and SaaS verified on the domain (e.g., ServiceNow, Salesforce, Atlassian, Okta). Label all of these as hypotheses. |
| **Web tech detection** | Response headers + homepage markup | CDN / hosting / web platform hypotheses |
| **News** | Google News RSS + GDELT + discovered newsroom RSS | Recent coverage → Signals |
| **PeeringDB** (optional toggle) | PeeringDB API | Network presence and data center facilities where the org peers. Useful context for data center conversations. |
| **USAspending** (optional, public-sector or contractor accounts) | USAspending.gov API | Federal awards received or awarded, agencies, amounts |

### 6.4 Merge policy and field locking
- Precedence: **user-entered > user-verified > high-confidence public > medium > low**.
- **Any field the user edits by hand is locked automatically.** Enrichment never overwrites a locked field. It shows a "newer public value available" hint instead.
- When sources conflict (e.g., two employee counts), keep all values, show the conflict, and let the user pick.
- Store field-level history so the user can see what changed and when.

### 6.5 Enrichment UX
- **Accounts tab:** "Fetch public data" on each row, a bulk "Enrich selected" action, an enrichment status column (Not enriched / Queued / Running / Review needed / Up to date / Stale), and a **data completeness %** column.
- **Account 360:** "Fetch public data" button in the header, plus a **Proposed Updates** panel showing a field-by-field diff (current vs proposed), source chips, confidence, and evidence. Accept all, accept by section, accept or reject per field.
- Every enriched field shows a small source indicator. Hover for source, date, and link.
- **Manual-entry prompts:** after enrichment, list the fields public sources couldn't fill (e.g., "Current infrastructure vendors," "Budget cycle notes," "Key relationships") so the user knows exactly what to add by hand.
- **Bulk queue:** background jobs with concurrency limits, progress UI, pause/resume, survives restart, and a per-account error log.
- **Refresh:** each enricher re-runs when its TTL expires (filings daily, news on the signals schedule, jobs weekly, firmographics quarterly). A "Stale data" filter is available.

### 6.6 Account 360 additions powered by enrichment
- **Corporate hierarchy** tree (GLEIF + Wikidata), with the option to roll subsidiaries up under a parent account.
- **Financial snapshot:** revenue, net income, and capex trends with sparklines (public companies), plus fiscal year end.
- **Initiative evidence board:** extracted initiatives grouped by AHEAD practice area, each with snippets and links.
- **Tech-stack hypotheses** grouped by category, with evidence and confidence, which the user can confirm or reject.
- **Hiring trend** chart by function.

**Phase 6 done when:** a user can import 50 real accounts, resolve identities, bulk-enrich them, review and accept proposals, and see provenance on every enriched field. Unit tests cover each enricher's normalize step with recorded fixtures (no live calls in CI), and the merge policy and locking have tests.

---

## Phase 7: Efficiency features for daily use

### 7.1 "My Day" home view (make it the default landing page)
- Today's meetings (from an imported `.ics` calendar file; no calendar connector), with a one-click prep brief for each.
- Top 10 signals since the last visit, ranked by relevance.
- Tasks due or overdue, accounts past their touch cadence, and deals with close dates in the next 30 days or stalled.
- One-line "Suggested next action" per item, with the reason shown.

### 7.2 One-click meeting prep brief
- For any account: a 1-page brief with company snapshot, latest 5 signals, open opps, buying-committee coverage, last 3 touches, initiative evidence, recommended plays, and suggested questions.
- Opens in Presentation Mode or exports to PDF/Markdown through the existing export framework (internal audience by default).

### 7.3 Signal triage, inbox-style
- Keyboard-driven triage queue: `j/k` to move, `s` star, `d` dismiss, `p` convert to play, `o` convert to opportunity, `n` add note, `t` create task.
- "Inbox zero" counter and a weekly digest page summarizing what was triaged.

### 7.4 Tasks and next steps
- A `Task` entity linked to any account, opp, signal, or contact. Fields: due date, priority, status, and recurring options.
- Every opportunity requires a dated next step. Flag opps without one.
- Quick-add from anywhere with `⌘K → "task"` or the `t` key.

### 7.5 Coverage cadence and territory health
- Cadence rules by tier, user-editable (e.g., Strategic = touch every 14 days, Growth = 30, Maintain = 60).
- A territory view showing all accounts by tier, health, last touch, whitespace, and pipeline, with "Neglected accounts" and "Most momentum" lists.

### 7.6 Partner and OEM co-sell tracker
- A `PartnerRep` entity: partner company (user-editable list, e.g., hardware OEMs, cloud providers, software vendors), rep name, territory, and accounts they cover.
- Per account: which partner reps are engaged and on which opps. Per partner: shared pipeline, open registrations (user-entered), and last joint touch.
- Partner rep data is user-entered only.

### 7.7 Fiscal and budget timing
- Use fiscal year end from EDGAR (or manual entry) to estimate budget-planning windows. Show "Budget planning likely starts in ~N weeks" on the account and in My Day.
- A timeline widget of fiscal-year ends across the portfolio.

### 7.8 Data quality and completeness
- Completeness score per account (weighted by which fields matter for each tier), shown on the Accounts tab and Account 360.
- A "Fix it" queue listing the most valuable missing fields across the portfolio.

### 7.9 Smart lists and saved views
- Saved filters shared across modules (e.g., "Strategic accounts with AI initiative evidence and no AI opp"), pinned to the sidebar.
- A query builder over account, signal, and opp fields.

### 7.10 Quick capture
- A global quick-note shortcut. Paste raw meeting notes into an account and tag them; next-step lines become tasks with one click (a rules-based "Action:" / "Next:" / "TODO" parser for now).

**Phase 7 done when:** My Day is the landing page and works with real data, all keyboard shortcuts are listed in a `?` help overlay, and each feature has e2e coverage of its main flow.

---

## Phase 8: Team-ready foundations (build the structure, don't host)

The goal is for the team to be able to share this later without a rewrite. **Do not deploy anything or add external hosting.** That waits for company approval.
- Add `ownerId`, `teamId`, `createdBy`, and `updatedBy` to all core entities. Add a simple local user profile now.
- An auth abstraction (`AuthProvider` interface) with a local single-user implementation. Leave an SSO slot for later.
- Field-level visibility roles defined in config (e.g., Client Director, Associate Client Director, Solutions Architect, Inside Sales), applied wherever data is displayed and exported.
- Comments and `@mentions` on accounts and opps, stored locally for now.
- **Shareable packs:** export an account (or a set of accounts) with chosen fields to a portable JSON file a teammate can import into their own ACC, with redaction controls.
- A shared Play Library export/import so the team can standardize plays.
- An audit log covering imports, enrichment accepts, exports, and deletes.
- Document the path to a hosted multi-user version (Postgres, SSO, deployment options) in `docs/TEAM_DEPLOYMENT.md` as a proposal only.

**Phase 8 done when:** every record has ownership metadata, shareable packs work round-trip between two local databases, and the team deployment proposal is written.

---

## Phase 9: Polish and hardening
- Run a performance pass with 500 real-shaped accounts (generate them in the **test DB only**).
- Accessibility pass (WCAG AA), plus a screenshot review of every page in light and dark mode, empty and populated.
- Automatic daily local backup with retention (keep the last 14), and a restore UI.
- Update `README.md`, `CLAUDE.md`, and `docs/ADDING_AN_ENRICHER.md` (a worked example of adding a new public source).

---

## Working style
- Stop after each phase. Run typecheck, lint, unit + e2e tests, and the screenshot pass. Fix failures, commit, and summarize what changed and what you need from me.
- Never invent facts about real companies. If a source returns nothing, leave the field empty and add it to the manual-entry prompts.
- If a source's terms prohibit automated access, skip it and tell me.
- Keep enrichers and features modular. Adding a source or feature should mean adding one folder.
- Ask before any change that diverges from this spec or from `CLAUDE.md`.

---

## Still queued as add-ons (do not build yet)
1. Data Center Sandbox (full 2D/3D builder, power/cooling simulation, mock ops console, customer tour mode)
2. Advanced exports (branded PPTX, QBR packs, scheduled digests)
3. AI assistant add-on (10-K summarization, account briefs, message drafting). Off by default, and the user chooses what data is sent.
4. Approved integrations (CRM, calendar, email) through the private adapter slot
5. Hosted multi-user deployment, after company approval