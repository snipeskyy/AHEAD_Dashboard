# Account Command Center (ACC)

A local-first sales intelligence dashboard for managing a portfolio of enterprise accounts. You can:

- **understand** each account (Account 360)
- **see what's changing** (live public signals)
- **plan pipeline** (opportunities, MEDDPICC, forecast)
- **run outreach** (plays, campaigns, messages, events)
- **produce executive-ready summaries** (exports with audience-aware redaction)

> **Privacy model.** Everything runs on `localhost` against a local SQLite database, with no telemetry. The only
> outbound calls are the public data sources you enable (news RSS, SEC EDGAR, public job boards, GDELT). Demo data is
> entirely fictional and flagged with a **DEMO DATA** badge.

## Quick start

```bash
npm install          # also creates .env.local from .env.example and generates the Prisma client
npm run setup        # applies migrations and seeds deterministic demo data (150 accounts, 600 opps, 15k signals, 2k touches)
npm run dev          # http://localhost:3000 (web) + background worker
```

Optional: set `SEC_USER_AGENT` in `.env.local`, e.g. `"Account Command Center (personal research) you@example.com"`,
to enable SEC EDGAR filings. SEC requires a descriptive User-Agent that includes contact info.

## Scripts

| Script                           | What it does                                                               |
| -------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                    | Next.js dev server + worker (`dev:web` for the web app only)               |
| `npm run build` / `npm start`    | Production build / serve (web + worker)                                    |
| `npm run seed`                   | Regenerate fictional demo data (deterministic; your own accounts are kept) |
| `npm run db:migrate -- --name x` | Create and apply a schema migration (handles the search index)             |
| `npm run check`                  | Typecheck + lint + unit tests                                              |
| `npm test`                       | Vitest unit tests                                                          |
| `npm run e2e`                    | Playwright end-to-end tests                                                |
| `npm run screenshots`            | Light/dark screenshots of every main page into `screenshots/`              |

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
| Google News RSS    | Real accounts (toggle per account) | Unofficial endpoint; for personal research use. Rate-limited to 1 request / 2 s and cached for 30 min.   |
| Custom RSS         | Accounts with feeds you add        | For company newsrooms and trade press.                                                                   |
| SEC EDGAR          | Accounts with a ticker             | Requires `SEC_USER_AGENT` in `.env.local`. Resolves ticker → CIK, then reads 8-K, 10-K and 10-Q filings. |
| Greenhouse / Lever | Accounts with a board slug         | Hiring roll-ups, plus initiative and tech-stack evidence that links to the job post.                     |
| GDELT              | Real accounts (off by default)     | Strict limit of 1 request / 5 s.                                                                         |
| Manual             | Any account                        | Paste a URL and add notes.                                                                               |
| Demo simulator     | Fictional demo accounts            | Makes the live feed work offline.                                                                        |

How sources run:

- The worker fetches on a schedule (every 30 minutes by default) and backs off when a source keeps failing.
- Use **Fetch now** in Live Signals or Settings → Data sources to run immediately.
- Set `PUBLIC_FETCH_ENABLED=false` to stop all outbound requests.

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

## DC Sandbox (add-on, coming next)

`/sandbox` previews the data center scenario sandbox: the data model (`SandboxScenario`), a generic
`ComponentLibrary` ("illustrative, not vendor-certified"), and a pluggable `SimulationEngine` interface in
`src/modules/sandbox/lib/types.ts`. It also shows a static rack elevation.

## Keyboard

- `⌘K` / `Ctrl+K`: command palette (jump to an account, search, create, run actions)
- `G H` / `G A` / `G S` / `G O` / `G D`: go to Home, Accounts, Signals, Opportunities, Demand Gen
- `G ,`: open Settings

## Status

| Phase                                                           | Status |
| --------------------------------------------------------------- | ------ |
| 1. Foundation (shell, registry, schema, seed, settings, search) | ✅     |
| 2. Command Home grid, Account 360, Opportunities                | ✅     |
| 3. Public adapters, SSE live feed, demand gen                   | ✅     |
| 4. Exports, sandbox stub, presentation and performance polish   | ✅     |

See `CLAUDE.md` for conventions and the rules every contribution must follow.
