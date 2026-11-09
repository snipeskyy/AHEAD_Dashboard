# Account Command Center (ACC)

A local-first sales intelligence dashboard for managing a portfolio of enterprise accounts. You can:

- **understand** each account (Account 360)
- **see what's changing** (live public signals)
- **plan pipeline** (opportunities, MEDDPICC, forecast)
- **run outreach** (plays, campaigns, messages, events)
- **produce executive-ready summaries** (exports with audience-aware redaction)

> **Privacy model.** Everything runs on `localhost` against a local SQLite database, with no telemetry. The only
> outbound calls are the public data sources you enable (news RSS, SEC EDGAR, public job boards, GDELT). The app ships
> with no demo data: you import the accounts you cover, and test fixtures live in a separate test database.

## Quick start

```bash
npm install          # also creates .env.local from .env.example and generates the Prisma client
npm run setup        # applies database migrations (no demo data)
npm run dev          # http://localhost:3000 (web) + background worker
```

The landing page is **My Day** (Command Home moved to `/dashboard`). On first run it shows a short onboarding: **Import accounts → Resolve identities → Enrich → Review**. Use
**Import** (sidebar, or ⌘K → "Import") to bring in accounts from CSV, Excel or a pasted list.

**Upgrading an existing install that has demo data:**

```bash
git pull && npm install
npm run db:deploy      # apply the Phase 5 migration
npm run db:purge-demo  # writes backups/pre-purge-<time>.json, shows counts, asks to confirm
```

Optional: set `SEC_USER_AGENT` in `.env.local`, e.g. `"Account Command Center (personal research) you@example.com"`,
to enable SEC EDGAR filings. SEC requires a descriptive User-Agent that includes contact info.

## Scripts

| Script                           | What it does                                                          |
| -------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                    | Next.js dev server + worker (`dev:web` for the web app only)          |
| `npm run build` / `npm start`    | Production build / serve (web + worker)                               |
| `npm run db:backup`              | Write a full JSON backup to `backups/`                                |
| `npm run db:reset`               | Delete everything (typed confirmation, backup first)                  |
| `npm run db:purge-demo`          | One-time removal of old demo data (backup first; real data kept)      |
| `npm run test:db:seed`           | Wipe and reseed the separate test database with fictional fixtures    |
| `npm run db:migrate -- --name x` | Create and apply a schema migration (handles the search index)        |
| `npm run check`                  | Typecheck + lint + unit tests                                         |
| `npm test`                       | Vitest unit tests                                                     |
| `npm run e2e`                    | Playwright end-to-end tests (own server on :3100, test database only) |
| `npm run screenshots`            | Light/dark screenshots of every main page into `screenshots/`         |

## Architecture

```
Browser ──TanStack Query──▶ Next.js route handlers (/api/*, Zod-validated) ──Prisma──▶ SQLite
   ▲                                                                                  ▲
   └──────────── SSE (Phase 3) ◀── tails new rows ──┐                                 │
                                                    Worker process (scheduler, public adapters, rescoring)
```

- **Module registry.** Every feature is a module in `src/modules/<id>/module.ts`. The sidebar, routes, command palette
  commands, widget picker, settings forms, feature flags and export builder are all generated from the registry.
  Adding a module means adding a folder. See [docs/ADDING_A_MODULE.md](docs/ADDING_A_MODULE.md).
- **Data adapters.** `src/lib/adapters` defines a `DataAdapter` interface for each source (`seed`, `manual`, `public`,
  `private-future`). The private slot exists so approved company integrations can be added later. None are built.
- **Explainable scoring.** Health, whitespace, signal relevance, MEDDPICC completeness and deal risk are pure
  functions that return their inputs and formula. Weights are editable in Settings.
- **Search.** A `SearchProvider` interface with a SQLite FTS5 implementation powers the ⌘K command palette.
- **Theming.** Design tokens live in `src/app/globals.css`, with light and dark modes plus 5 accent presets. All
  branding is in `src/config/theme.ts`. Chart series colors are a fixed, colorblind-validated palette.

## Live data (public sources only)

| Source             | Applies to                         | Notes                                                                                                    |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Google News RSS    | Real accounts (opt-in per account) | Unofficial endpoint, so off by default. Rate-limited to 1 request / 2 s and cached for 30 min.           |
| Custom RSS         | Accounts with feeds you add        | For company newsrooms and trade press.                                                                   |
| SEC EDGAR          | Accounts with a ticker             | Requires `SEC_USER_AGENT` in `.env.local`. Resolves ticker → CIK, then reads 8-K, 10-K and 10-Q filings. |
| Greenhouse / Lever | Accounts with a board slug         | Hiring roll-ups, plus initiative and tech-stack evidence that links to the job post.                     |
| GDELT              | Real accounts (off by default)     | Strict limit of 1 request / 5 s.                                                                         |
| Manual             | Any account                        | Paste a URL and add notes.                                                                               |

How sources run:

- The worker fetches on a schedule (every 30 minutes by default) and backs off when a source keeps failing.
- Use **Fetch now** in Live Signals or Settings → Data sources to run immediately.
- Set `PUBLIC_FETCH_ENABLED=false` to stop all outbound requests.

## Import

**Import** (`/import`) handles five kinds of data: accounts, contacts, opportunities, notes and partner reps.

1. Pick the type and download a CSV or Excel template if you want one.
2. Upload a `.csv` / `.xlsx` file (parsed on this machine, up to 5,000 rows) or paste rows. For accounts you can paste
   one company per line, optionally followed by a domain.
3. Map columns. Common headers match automatically; save a mapping to reuse it. The first 20 rows preview with
   row-level errors.
4. Review duplicates. Accounts match on domain first, then on the normalized legal name; contacts, opportunities and
   notes match within their account. Choose **merge**, **skip** or **create** per row. Merging never erases a value
   with a blank cell.
5. Import. Every import is logged under **History** and can be undone in one click.

Contacts, opportunities and notes must name an account that already exists. Real accounts get no generated
intelligence; it comes only from public sources or your own entries.

## Public-data enrichment

**Enrich all** / **Enrich selected** on Accounts, or **Fetch public data** on any Account 360, queues the account for
the background worker. Each source proposes values with a source link and confidence; review them on the account's
**Profile** tab (accept all, by section, or per field). Fields you edit are locked and never overwritten.

| Source                 | Fills                                                                                               | Needs                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Company website        | Description, HQ, careers/newsroom/IR links, RSS feed, job board, web-tech hypotheses                | Domain (robots.txt honored)                        |
| SEC EDGAR              | CIK, SIC industry, HQ, fiscal year end, 5-year revenue / net income / capex                         | Ticker or CIK + `SEC_USER_AGENT`                   |
| 10-K text              | Initiative evidence (AI, data center, cloud, consolidation, cost, security, ERP, M&A) with snippets | Same as SEC                                        |
| SEC insider filings    | Executive officers (name + title) as Buying Committee suggestions                                   | Same as SEC                                        |
| GLEIF                  | Legal name, HQ, parent / ultimate parent / subsidiaries                                             | —                                                  |
| Wikidata / Wikipedia   | Founded, employees, revenue, CEO, industry, subsidiaries, summary                                   | —                                                  |
| Public DNS             | Email platform and SaaS verified on the domain (hypotheses)                                         | Domain                                             |
| Job boards             | Open roles by function (trend), hiring-based evidence, tech hypotheses                              | Greenhouse / Lever / Ashby / SmartRecruiters board |
| PeeringDB (optional)   | Networks and peering facilities                                                                     | —                                                  |
| USAspending (optional) | Federal contract awards by agency                                                                   | —                                                  |

**Resolve identity** (Account 360) searches SEC, GLEIF and Wikidata and asks you to pick when there's more than one
plausible company. Add `ENRICH_USER_AGENT="Account Command Center (research) you@yourcompany.com"` to `.env.local`
(Wikimedia asks for a contact User-Agent). Toggle sources and auto-fill in Settings → Data sources. To add a source,
see [docs/ADDING_AN_ENRICHER.md](docs/ADDING_AN_ENRICHER.md).

## Branding (local brand pack)

To use your company's logo and colors, put the **approved** logo files and a `brand.json` in the `brand/` folder and
restart (see [brand/README.md](brand/README.md)). The folder is git-ignored, so trademarks never reach the repository.
The sidebar, browser tab, buttons, links and focus rings take the brand; chart series keep their fixed, colorblind-safe
palette. Settings → Appearance shows what loaded and switches between Brand and the neutral accents.

## Why "Fetch now" finds nothing

Each public source only runs for accounts it can use. Live Signals shows a **Source coverage** panel whenever no
source can run, with the fix for each: turn on Google News (opt-in) for all accounts in one click, add
`SEC_USER_AGENT` to `.env.local` for SEC filings on accounts with tickers, or add job-board slugs / RSS feeds on
Account 360 → Sources. Fetch now then reports how many new signals each source found.

## Exports

**Exports** (sidebar → Deliver, or **Export** on any Account 360) assembles a summary from every module's
`exportSections`:

1. Choose a scope: one account, a set of accounts, or the full portfolio.
2. Pick a template or enable, reorder and fine-tune sections. Each section's fields can be toggled individually.
3. Choose an audience. **Customer-facing** removes every field marked internal (probability, competitors, risk,
   scores, notes) and every internal-only section. The live preview highlights exactly what will be removed.
4. Generate **PDF**, **Markdown** or **PowerPoint**. Every export carries a version number, an optional watermark and
   a date stamp, and it lands in **History**, where you can download it again or re-run it with fresh data (the
   version is bumped).

Files are written to `exports/` (git-ignored). PDFs are printed by the pre-installed Playwright Chromium; if you run
ACC elsewhere, install a browser once with `npx playwright install chromium`.

## Presentation Mode

**Present** in the top bar (or ⌘K → "Toggle Presentation Mode") hides everything marked internal-only, including
amounts, probabilities, relevance scores, internal widgets and the forecast. It also enlarges charts and type for
screen-sharing. A banner stays visible with a one-click **Exit**.

## DC Sandbox

`/sandbox` lays out a data hall on a tile grid, sizes power, cooling and floor load, tests growth and failures, walks
it in 3D and tours it with a customer. The component library is generic ("Illustrative, not vendor-certified") and the
operations console is simulated.

## Data contract & local API

The **ACC Data Contract** (`acc-data` v1) is a neutral, versioned JSON format for your own account knowledge:
accounts, contacts, opportunities, activities, notes, tasks and partner reps. It has no personal contact details and no
pricing.

- **Import.** Settings → Data contract & API imports a contract file. You get a preview first, it dedupes like CSV
  imports, and the whole file can be undone from Import → History.
- **Export.** Download internal or customer-safe files there too.
- **Local API.** An optional, token-protected, read-only API (`/api/v1/*`) lets another tool on your computer read the
  workspace. It is off by default.

See `docs/DATA_CONTRACT.md` (schema, OpenAPI, examples) and `docs/INTERNAL_PORT.md` (the boundary for a future internal
port: no internal data and no live connector without approval).

## Keyboard

- `⌘K` / `Ctrl+K`: command palette (jump to an account, search, create, run actions)
- `G H` / `G B` / `G A` / `G S` / `G O` / `G D`: go to My Day, Command Home, Accounts, Signals, Opportunities, Demand Gen
- `G T` / `G R` / `G P` / `G L`: Tasks, Territory, Partners, Smart lists
- `T`: new task · `C`: quick capture (notes → tagged note + tasks from `Action:`/`Next:`/`TODO` lines) · `?`: all shortcuts
- Triage (Live Signals → Triage): `J`/`K` move, `S` star, `D` dismiss, `P` play, `O` opp, `N` note, `T` task, `E` handled
- `G ,`: open Settings

**Presentations:** Exports → pick a template (Customer QBR deck, Executive summary deck, Account plan, Partner
co-sell brief, Portfolio readout, …) → **Slide deck** style. You get live slide thumbnails (hide any slide, edit
speaker notes), a full-screen **Present** mode (←/→, N for notes, Esc), and PowerPoint with editable charts and
notes, or a 16:9 PDF. With a brand pack in `brand/`, decks use your logo and colors; otherwise a neutral theme.

**DC Sandbox:** sidebar → DC Sandbox. Start from a room (empty, enterprise row, AI pod), drag racks on a 0.6 m grid,
fill them with generic devices, and see power, feeds, heat to air vs liquid, cooling after N+1/2N, PUE estimate, floor
load and a growth runway, with every warning explained. Try failure what-ifs (lose a cooling unit or feed A), make a
what-if copy to compare before/after, walk it in 3D, run a guided **Customer tour**, watch a simulated ops console,
start a business case from it, and export the floor plan and capacity into decks. Illustrative, not vendor-certified.

**TCO & business cases:** sidebar → TCO & business cases (or "Business case" on an account / "Build a TCO" on a
deal). Start from a structure (refresh vs cloud, own DC vs colocation, on-prem vs cloud GPU, blank), enter your
assumptions (amounts, kW, PUE, $/kWh, FTEs, escalation, growth), and see TCO, savings, NPV, payback, IRR and a
sensitivity tornado update live. Save versions to compare, mark one Final, and export it with the
"TCO business case deck" template. Nothing is pre-priced: every figure is yours and labeled as an estimate.

**Backups:** the background worker saves a full JSON backup to `backups/` once a day and keeps the last 14
(Settings → Data → Backups & restore). From there you can back up now, download a backup, or restore one (type
RESTORE to confirm; your current data is saved first). Copy `backups/` somewhere safe from time to time.

**Team & sharing (local, no hosting):** set your name and role in Settings → Profile & team (roles hide fields such as
deal amounts on screen, in exports and in packs). Share accounts with a teammate as a **pack** file (Team & sharing →
Share accounts); they import it with a preview, matched by domain/legal name, and can undo it from Import → History.
The Play Library exports/imports the same way. Comments with @mentions sit on every account and opportunity, and the
Audit log records imports, enrichment decisions, exports and deletes. The hosted multi-user path is a proposal in
`docs/TEAM_DEPLOYMENT.md`.

**Calendar:** export your calendar as `.ics` and import it on My Day. Only titles, times and attendee **domains** are
stored (never addresses or names); meetings are matched to accounts by domain and get a one-click prep brief.

## Status

| Phase                                                           | Status |
| --------------------------------------------------------------- | ------ |
| 1. Foundation (shell, registry, schema, seed, settings, search) | ✅     |
| 2. Command Home grid, Account 360, Opportunities                | ✅     |
| 3. Public adapters, SSE live feed, demand gen                   | ✅     |
| 4. Exports, sandbox stub, presentation and performance polish   | ✅     |
| 5. Clean slate, onboarding, import wizard with dedupe + undo    | ✅     |
| 6. Identity resolution and public-data enrichment               | ✅     |
| 7. My Day, prep briefs, triage, tasks, cadence, partners, lists | ✅     |
| 8. Team foundations: ownership, roles, comments, packs, audit   | ✅     |
| 9. Polish: performance, accessibility, daily backups + restore  | ✅     |
| 10. Deliverables engine: branded decks, exec summaries          | ✅     |
| 11. TCO / business-case builder (your assumptions only)         | ✅     |
| 12. Data Center Sandbox (floor plan, 3D, capacity, what-ifs)    | ✅     |
| 13. Data contract, file import/export, local read-only API      | ✅     |

See `CLAUDE.md` for conventions and the rules every contribution must follow.
