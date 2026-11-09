# CLAUDE.md — Account Command Center (ACC)

Local-first sales-intelligence dashboard for an enterprise account director. Read this before changing anything.
Build specs: `PROMPT.md` (Phases 0–4) and `PROMPT_ROUND2.md` (Phases 5–9). The approved plan is in `docs/PHASE0_PLAN.md`.

## Non-negotiable rules (spec §2)

1. **No internal or confidential data.** Never add, request, or expect employer-internal data, CRM exports, pricing,
   margins, contracts, or non-public customer info.
2. **The app never writes demo data (Phase 5).** Synthetic fixtures live in `tests/fixtures/seed/` and are written
   only to the TEST database (`DATABASE_URL_TEST`) via `scripts/with-test-db.mjs`; the seed CLI refuses otherwise.
   Fixtures stay fictional (invented names, `.example` domains, no tickers, `isDemo = true`). The `isDemo` column is
   kept as a guard: if any demo row reaches the real DB, `DemoDataWarning` (`src/components/shell/data-guard.tsx`)
   shows a red banner until it's removed in Settings → Data.
3. **Real accounts come from public sources only.** Never generate initiatives, tech stack, or signals for a
   non-demo account. Every intelligence item on a real account needs a public `sourceUrl`, or
   `source = "user-hypothesis"`.
4. **No third-party brand assets in the repository.** Committed code, fixtures and docs stay neutral: no AHEAD, OEM
   or customer logos or names, and partners/competitors are generic labels ("Compute OEM A"). Neutral defaults live in
   `src/config/theme.ts`. Company branding (approved by the user, Nov 2026) comes only from the local, git-ignored
   **brand pack** in `brand/` (`brand.json` + the user's official logo files; see `brand/README.md`). Never commit,
   recreate, trace or guess a company logo or palette.
5. **Local and private.**
   - No telemetry: `NEXT_TELEMETRY_DISABLED=1` and `CHECKPOINT_DISABLE=1` are set in `.env.local`.
   - No external calls except the public adapters the user enables.
   - Secrets live only in `.env.local`, which is git-ignored.
   - Never hardcode `SEC_USER_AGENT`.
6. **Integration-ready, not integrated.** The `private-future` adapter slot throws `AdapterNotConfiguredError`. Don't
   build CRM or marketing-automation connectors.

## Commands

| Task               | Command                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| First-time setup   | `npm install && npm run setup` (applies migrations only; an empty DB opens on the onboarding flow)                                 |
| Dev (web + worker) | `npm run dev` (web only: `npm run dev:web`)                                                                                        |
| Test DB fixtures   | `npm run test:db:seed` (wipes + seeds `prisma/test.db`; never the real DB)                                                         |
| Backup / reset     | `npm run db:backup`; `npm run db:reset` (typed confirm + backup); `npm run db:purge-demo` (one-time demo removal, backup first)    |
| Schema change      | edit `prisma/schema.prisma`, then `npm run db:migrate -- --name <change>` (**never** raw `prisma migrate dev`; see "Search index") |
| Checks             | `npm run check` (typecheck + lint + unit tests)                                                                                    |
| E2E / screenshots  | `npm run e2e`, `npm run screenshots` (own server on :3100 against the test DB; output in `screenshots/`)                           |
| Format             | `npm run format`                                                                                                                   |

## Folder map

```
prisma/schema.prisma          data model (SQLite now, Postgres-compatible)
tests/fixtures/seed/          TEST-ONLY fictional fixtures (index.ts = runSeed, run.ts = guarded CLI, wipe.ts, generators/*)
src/app/(shell)/[[...slug]]   registry-driven router: resolves module routes, so don't add pages here
src/app/api/*                 route handlers (Zod-validated; wrap with handler() from lib/server/http)
src/components/ui             shadcn primitives (generated; don't hand-edit except imports)
src/components/shell          sidebar, top bar, ⌘K palette, notifications, note dialog, shortcuts
src/components/states         Empty / Error / Skeleton / ModulePlaceholder
src/config                    theme.ts (ALL branding), practice-areas.ts (taxonomy defaults)
src/lib/domain/enums.ts       Zod enums: the source of truth for enum-like String columns
src/lib/scoring               health, whitespace, relevance, MEDDPICC, deal risk (pure, explainable)
src/lib/tagging               keyword → practice-area rules engine
src/lib/search                SearchProvider interface + SQLite FTS5 implementation
src/lib/settings              typed settings registry (schema.ts), DB store, server helpers
src/lib/adapters              DataAdapter interface + source catalog + public adapters
src/lib/import                import kinds (fields + pure normalizers), mapping, paste parser, value parsers
src/lib/server/import         parse (CSV/XLSX), plan (validate/match/dedupe/diff), commit, undo
src/lib/backup, src/lib/data  JSON snapshots (backups/), demo purge
src/lib/auth                  actor context (runAs), AuthProvider (local + SSO slot), profile/team helpers
src/lib/team                  pure team helpers: @mentions, shareable pack schema + section gating
src/lib/server/packs          pack export / import (+ undo via ImportBatch kind "pack"), Play Library packs
src/config/roles.ts           roles and field visibility (screen, exports, packs)
src/lib/enrich                enrichment: fields catalog, merge policy, store, runner, identity, sec/gleif/wikidata helpers
src/lib/enrich/enrichers/<id> one folder per public source (auto-discovered); __fixtures__ + __tests__
scripts/                      gen-module-index, db-migrate, db-reset, db-backup, purge-demo, with-test-db
src/modules/<id>/module.ts    module manifests (auto-discovered); pages/, components/, widgets/
src/modules/registry.ts       registry + validation + route matching (do not list modules by hand)
src/worker                    background worker process (job queue, rescoring; adapters in Phase 3)
e2e/                          Playwright tests + screenshot pass
```

## Conventions

- **Modules.** One folder, `src/modules/<id>/`, with a default-exported `AccModule` in `module.ts`. The index
  `src/modules/_generated.ts` is regenerated by `npm run gen:modules`, which runs automatically on dev, build, and
  typecheck.
  - Every module **must** declare `exportSections`, even an empty one.
  - Widget and export-section ids are namespaced `<module-id>.<name>`.
  - See `docs/ADDING_A_MODULE.md`.
- **Enums.** Store them as `String` in Prisma and validate with `src/lib/domain/enums.ts`. List and structured data
  goes in `Json` columns.
- **Scores are explainable.** Scoring functions return `{ value, components[], formula }`. Persisted scores
  (`healthScore`, `whitespaceScore`, `relevance`) are recomputed by `computeScoresForAccounts` and the worker's
  `rescoreSignals`.
- **Settings.** Add a key to `src/lib/settings/schema.ts` with a Zod schema and a default. Read it with
  `getSetting()` on the server or `useSetting()` on the client. Missing rows fall back to the default.
- **Data flow.** Pages are thin. Client components fetch from `/api/*` with TanStack Query (`src/lib/api-client.ts`),
  and UI-only state lives in Zustand (`src/stores`).
  - Persisted Zustand state uses `skipHydration` and is rehydrated after mount, to avoid SSR mismatches.
- **Cache Components is OFF** in `next.config.ts`. The app is fully dynamic and local, and the root layout is
  `force-dynamic`.
- **Next.js 16.** APIs differ from older versions; read `node_modules/next/dist/docs/` before using unfamiliar APIs.
  Route handler `params` is a Promise.
- **React compiler lint rules** are on:
  - Don't call `setState` synchronously in effects. Use keyed remounts or event handlers instead.
  - Don't call `Date.now()` during render.
  - Don't mutate `document` inside components (use `src/lib/client/dom.ts`).
  - Use `useMounted()` for client-only values such as the theme.
- **Charts** use one ECharts wrapper (Phase 2) with the fixed, validated series palette from CSS tokens
  (`--series-1..8`, `--seq-*`, `--status-*`).
  - Never color a series with the UI accent. Color follows the entity.
  - No dual axes.
  - Every chart gets a table fallback.
- **Accessibility.** Every interactive element has a visible focus state and an aria label. Status colors always
  come with an icon and a label.
- **Presentation Mode** sets `html[data-presentation=true]`. Mark internal-only UI with `data-internal-only="true"`.
  Exports use the same field `visibility` metadata (`internal` | `customer-safe`).
- Keep files under ~300 lines. Use `any` only with an eslint-disable comment that explains why.

## Search index (important)

The FTS5 table `search_index` and its triggers are **created at runtime** (`ensureReady()`), not by Prisma
migrations, because Prisma would otherwise report drift.

- `npm run db:migrate` drops the index, runs `prisma migrate dev`, and recreates it.
- The seed drops the index before bulk inserts and rebuilds it afterward.
- If you add a searchable entity, extend `SOURCES` in `src/lib/search/sqlite-fts.sql.ts`.

## Phase 2 conventions

- **Widgets.** A widget component receives `{ size, height }`, where `height` is the body height in px. Charts and
  lists must fit that height and scroll internally.
  - Widgets are declared in the owning module's `widgets` array and lazy-loaded by `WidgetFrame`.
  - Layouts are stored as `{ i, widgetId, x, y, w, h }[]` on a 12-column grid with 56px rows (`src/lib/dashboard/layouts.ts`).
  - The three default layouts are created on first `GET /api/layouts`.
- **One filter row.** On Opportunities, the filter bar drives every view. KPIs, forecast and analytics are computed
  client-side from the filtered rows with the pure functions in `src/lib/pipeline/analytics.ts`.
- **Opportunity writes go through `updateOpportunity()`** (`src/lib/server/opportunities.ts`). It enforces:
  - stage history rows
  - default probability and forecast category
  - close-date push counting
  - practice-status sync (open ⇒ ActiveOpp, won ⇒ Delivered)
  - activity log entries
  - account rescoring
- **Real-account intel policy.** `intelPolicyViolation()` in `src/lib/intel/policy.ts` guards every initiative and
  tech-stack write. User-entered items are always stored as `source = "user-hypothesis"`.
  - Opening angles and pain points are derived only from evidence (initiatives and signals), and each one links to
    its evidence (`src/lib/intel/angles.ts`).
- **Account import.** Accounts are imported through `createRealAccounts()`, which takes public identifiers only. It
  normalizes domains and tickers, dedupes by name or domain, sets `isDemo = false`, and generates no intelligence.
  An example file is at `examples/target-accounts.csv`.
- **Lists.** Large lists use the virtualized `DataTable`. Signals are cursor-paginated server-side
  (`querySignals`). Opportunities (600) and accounts (150) load once and are filtered client-side.
- **Layout safety.** A base CSS rule gives implicit grids a `minmax(0, 1fr)` column so content can't overflow on
  mobile.
- **Verification builds.** Run `NEXT_DIST_DIR=.next-build npm run build` so a build can run while `next dev` is up.

## Phase 3 conventions (signals & demand gen)

- **Every signal enters through `ingestSignals()`** (`src/lib/ingest/ingest.ts`). The pipeline is:
  1. Zod validation
  2. dedupe hash (account + normalized URL + title, or the adapter's `dedupeKey`)
  3. tagging and relevance scoring
  4. insert, including `tagIndex`
  5. derived evidence, gated by `intelPolicyViolation`
  6. a notification when relevance ≥ the alert threshold

  Never write `Signal` rows directly.

- **Adapters** live in `src/lib/adapters/sources/*`, are listed in `SIGNAL_ADAPTERS`, and are contributed to the
  registry by the Signals module (`dataAdapters`).
  - Each adapter has `eligible()`, `fetch()` and a pure `normalize()`. Fixtures for `normalize()` are in
    `src/lib/adapters/__fixtures__`, anonymized with fictional names.
  - Outbound HTTP must go through `fetchText`/`fetchJson` in `src/lib/adapters/http.ts`. That gives a per-host
    rate limit, an `HttpCache` TTL with ETag, 429/5xx backoff, and timeouts.
  - Adapters run only in the worker, never in Next route handlers.
- **Per-source rules.**
  - SEC EDGAR needs `SEC_USER_AGENT` and throws `AdapterNotConfiguredError` without it.
  - Google News and GDELT only run for real (non-demo) accounts. Google News is **opt-in per account**
    (`sourceConfig.googleNews === true`; imports and new accounts default to off) because it has no official API.
  - Job boards roll up into one hiring signal per practice per ISO week, plus job-post evidence.
  - `crm-placeholder` must keep throwing until the company approves an integration.
- **Worker scheduler** (`src/worker/scheduler.ts`):
  - It runs on the `scheduler.intervalMinutes` interval.
  - Failing adapters back off exponentially, up to 6 hours.
  - "Fetch now" is a `JobRequest` of kind `fetch-now`, created via `/api/sources/fetch` or `/api/jobs`.
  - Other jobs: `rescore-signals` (hourly) and `retag-signals` (after rule or relevance edits).
- **SSE.** `/api/stream/signals` tails `Signal.createdAt` and `Notification.createdAt` by cursor, ignoring
  future-dated rows. The client side is `LiveSignalsProvider` in the app shell; subscribe with `useLiveSignals()`.
  New rows queue behind a "N new signals" banner instead of reflowing the feed.
- **Practice filtering** uses `Signal.tagIndex` (",a,b,") with `contains`, because JSON-array filters aren't
  portable. Keep it in sync with `toTagIndex()`.
- **Demand gen.**
  - The recommender is pure and explainable: every point comes from a `Reason` (`src/lib/demand-gen/recommender.ts`).
  - Keyword matches are whole-word.
  - `launchPlay()` creates a Campaign plus one planned Touch per sequence step.
  - The message builder is template-only (`src/lib/demand-gen/messages.ts`). Missing variables render as
    `[brackets]` and are listed.
  - `AiProvider` (`src/lib/ai/provider.ts`) is `nullAiProvider`, which is disabled. Nothing is ever sent.
- **Account pickers inside dialogs** must use `AccountPicker`. It renders in a portal so results are never clipped.
- **E2E tests** run on the TEST database: `e2e/global-setup.ts` wipes and reseeds `prisma/test.db`, and the
  Playwright web server runs through `scripts/with-test-db.mjs` on port 3100. Tests may create data freely.

## Phase 4 conventions (exports, sandbox, presentation)

- **Export pipeline.** `buildDocument(config)` (`src/lib/export/build.ts`) runs each enabled section's builder,
  then `applyRedaction()`, then renders chart SVGs server-side.
  - Builders live in `src/modules/<id>/export.server.ts` (`builders: SectionBuilders`). They are discovered into
    `src/modules/_generated.server.ts`, which is server-only.
  - Blocks (`src/lib/export/types.ts`) carry a `field` id. Redaction removes blocks, kv/list items and table columns
    whose field is hidden.
  - Customer audience hides every `visibility: "internal"` field and drops `internalOnly` sections. The user can't
    re-enable them (locked).
  - `mode: "preview"` marks content instead of removing it; the builder UI highlights it.
- **Formats.**
  - PDF: Playwright prints `/print/export/<id>`, which renders the saved snapshot `exports/<id>.json`.
  - Markdown: `documentToMarkdown`.
  - PPTX: `documentToPptx` (pptxgenjs, title slide plus paginated sections).
  - Everything is written to `exports/` (git-ignored). Re-run bumps the version.
- **Stub sections** (`status: "stub"`) show in the builder but can't be enabled or built.
- **Presentation Mode.**
  - Widgets with `internalOnly: true` are masked in the grid.
  - `Chart` enlarges fonts (`ChartTheme.fs`) everywhere. Outside widgets it also enlarges height; widgets keep their
    grid height via `ChartFixedHeightContext`.
  - Build chart options with `t.fs`, never a literal font size.
- **DC Sandbox** (full since Phase 12; see below). The generic library (`library.ts`) must stay vendor-neutral and
  labeled "Illustrative, not vendor-certified".
- **Accessibility.** `e2e/phase4.spec.ts` runs axe (WCAG 2.1 AA) on the main pages and fails on serious or critical
  violations.

## Phase 5 conventions (real data, import, first run)

- **No demo data at runtime.** No seed in `setup`, no demo simulator, no "Reset demo data". Remove legacy demo rows
  with `npm run db:purge-demo` or Settings → Data (both write `backups/pre-purge-<ts>.json` first; `backups/` is
  git-ignored). `purgeDemoData()` (`src/lib/data/purge-demo.ts`) also removes notes, activity, notifications and export
  history that point at demo rows.
- **Starter Plays** (`src/lib/demand-gen/starter-plays.ts`) are methodology, not account data: `Play.origin = "starter"`,
  installed lazily by `listPlays()` → `ensureStarterPlays()` unless the user cleared them
  (`demandGen.starterPlaysCleared`). Clear/restore in Settings → Data.
- **Imports** (`/import`, module `imports`). Kinds live in `src/lib/import/kinds/*`: field list (aliases, example,
  hint) + a pure `normalize()`. Adding a kind = one file + `KIND_DEFS` + `plan.ts`/`commit.ts`/`undo.ts` cases.
  - Flow: parse (server, CSV via papaparse / XLSX via exceljs; ≤10 MB, ≤5,000 rows) → map (auto-match by alias, then
    label; saved `ImportMapping`s) → `planImport()` (validate, resolve account refs, dedupe, diff) → `commitImport()`.
  - Dedupe: accounts by domain first, then `normalizeLegalName()`; children by account + key. In-file repeats too.
  - Merge only applies non-blank incoming values that differ (`mergePlan()` in `diff.ts`); blank cells never erase.
  - Every created/merged entity is an `ImportRecord` with a `before` snapshot; `undoImport()` deletes created rows and
    restores merged ones. Opportunities go through `createOpportunity(..., { quiet: true })` / `updateOpportunity()`.
  - Child kinds must reference an existing account; unknown accounts are row errors, never auto-created.
- **First run.** `/api/meta` returns `empty`; My Day (`/`) renders `Onboarding` (`src/lib/onboarding/steps.ts`:
  Import → Resolve → Enrich → Review; all steps available since Phase 6). Pages that need accounts
  wrap content in `NeedsAccounts`; widgets use `WidgetEmpty` / `NoOppsEmpty`. Never render a zero-data chart.
- **KPI targets start blank** (`quarterlyTarget`/`coverageTarget` default `0` = not set). `Kpis.targetSet` and
  `coverageTone()` drive the "Not set → Set a target in Settings" tiles.

## Brand pack & source coverage (post-Phase 5)

- `loadBrandPack()` (`src/lib/brand/brand-pack.ts`) reads `brand/brand.json` (re-read on change; `ACC_BRAND_DIR`
  overrides the folder, and `scripts/with-test-db.mjs` points it at a non-existent dir so tests never see a real pack).
  `deriveBrandTokens()` (`colors.ts`, pure) turns the brand hex into `--primary` / `--primary-foreground` /
  `--brand-soft` for the `brand` accent, adjusting the shade until it reaches 4.5:1 on the app surfaces.
  The root layout injects that CSS, sets `data-accent="brand"` by default when no appearance row is saved, adds the
  favicon, and passes `publicBrand()` to `BrandProvider` (`useBrand()`, `brandAssetUrl()`). Logos are served by
  `/api/brand/asset?name=logo|logoDark|mark` (only files named in brand.json). Chart series colors never change.
- **Source coverage.** `computeCoverage()` (`src/lib/adapters/coverage.ts`, pure) says per source how many accounts it
  would query and why not (opt-in Google News, missing `SEC_USER_AGENT`, no tickers/slugs/feeds, disabled source,
  `PUBLIC_FETCH_ENABLED=false`). `/api/sources` returns `coverage` + `runnable`; Live Signals shows the panel when
  `runnable === 0`. `POST /api/sources/google-news` bulk opts accounts in or out.
- **Jobs report results.** The worker writes `JobRequest.result` / `finishedAt`; `useFetchNow()` polls
  `/api/jobs/<id>` and toasts per-source outcomes (or says the worker isn't running).

## Phase 6 conventions (public-data enrichment)

- **Pipeline.** Identity resolution → enrichers → proposals → merge policy → review. Enrichers live in
  `src/lib/enrich/enrichers/<id>/` (default-export `Enricher`, pure `normalize.ts`, fictional fixtures); see
  `docs/ADDING_AN_ENRICHER.md`. They run in the **worker** (`drainEnrichmentQueue`, own lane, concurrency +
  pause from settings). The only server-side call path in Next is identity search (`/api/accounts/:id/identity`, read-only).
- **Every write goes through `src/lib/enrich/store.ts`**: `recordResult()` (per enricher run), `applyValue()`
  (provenance + history + Account column mirror + sourceConfig for job board / RSS), `acceptProposal()`,
  `rejectProposal()`, `setManualValue()` (user value, locked). Never write `AccountField` directly.
- **Merge policy** (`merge.ts`, pure, tested): user > verified > high > medium > low. Locked fields never change
  ("newer public value available" instead). High-confidence values auto-fill EMPTY or lower-precedence fields when
  `enrichment.autoApply` is on; everything else is pending. List items (`evidence.initiative:*`, `tech:*`,
  `contact:*`) are always reviewed; accepting creates Initiative / TechStackHypothesis / Contact with sourceUrl;
  decided list items aren't re-proposed.
- **Fields** are declared in `fields.ts` (`FIELD_DEFS`: section, kind, tier weights for completeness, Account column).
  Completeness = weighted filled fields + contacts ≥ 3 + initiatives > 0 (`completeness.ts`).
- **Sources & policy.** SEC (submissions, XBRL facts, 10-K text, Form 3/4 officers) needs `SEC_USER_AGENT`.
  Others send `ENRICH_USER_AGENT` (fallback SEC UA). Host gaps in `http.ts` (`HOST_GAP`). Website fetches go through
  `ctx.http.page()` (robots.txt honored). PeeringDB and USAspending are optional (off by default). Wikidata/GLEIF only
  auto-match on an exact normalized legal name; anything ambiguous is left for the identity dialog.
- **Material 8-K items** (1.01, 1.05, 2.01, 5.02) are `priority: "high"` signals: relevance floor 90, always alert.
- **Status** (`status.ts`): not-enriched / queued / running / review / up-to-date / stale / failed, from the latest job,
  runs vs TTL and pending proposals. `/api/enrichment/overview` feeds the Accounts columns and "Stale data" filter.
- **Contacts from filings** are suggestions with `Contact.source/sourceUrl`; nothing is added without acceptance.

## Phase 7 conventions (daily use)

- **Landing page.** My Day (module `my-day`, route `""`) is `/`; Command Home moved to `/dashboard` (`G B`).
  `myDay()` (`src/lib/server/my-day.ts`) assembles meetings, signals since `myDay.lastSeenAt`, due tasks, cadence,
  deals and budget timing. **Every item carries a `suggestion: { action, reason }`** from the pure helpers in
  `src/lib/daily/next-action.ts`; never show a suggestion without its reason.
- **Pure daily libs** live in `src/lib/daily/` (fiscal window, cadence, recurrence, notes parser, .ics parser, smart-list
  evaluator, questions), all unit-tested in `__tests__/daily.test.ts`.
- **Tasks** (`src/lib/server/tasks.ts`, `/api/tasks`) link to account / opp / signal / contact; the account is inferred
  from the opp or signal. Completing a recurring task creates the next occurrence. Quick add: `t` or ⌘K; the global
  `TaskDialog` is opened through `useUiStore().openTaskDialog(defaults)`.
- **Dated next step.** `Opportunity.nextStepDate`; `dealRiskFlags` adds `no-next-step` only when `nextStepDate` is
  passed (so old callers are unaffected). Set it through `updateOpportunity()`.
- **Calendar (.ics).** `parseIcs()` keeps attendee/organizer **domains only** (no addresses, no names), skips cancelled
  events, expands DAILY/WEEKLY RRULEs inside the import window. Your own domain (on ≥60% of meetings) and webmail
  domains are ignored when matching accounts.
- **Meeting prep brief.** `buildBrief()` (`src/lib/server/brief.ts`) feeds both `/accounts/:id/brief` and the export
  section `account-intel.brief` (`internalOnly`, so it never reaches a customer-audience export).
- **Triage.** `Signal.triagedAt/triageAction`; queue = untriaged, not dismissed, last 30 days, top 100 by relevance.
  `triageActive` in the UI store suppresses the global `t` / `c` shortcuts while the queue has focus.
- **Cadence & fiscal settings** are the `territory` module's `settingsSchema` (Settings → Modules), read with
  `territoryConfig()`. Planning window = FY start minus `planningStartMonths` .. minus `planningEndMonths`; labels say
  "likely" because they are an estimate from the public fiscal year end.
- **Partners** are user-entered only (`PartnerRep`, `OpportunityPartnerRep`, `PartnerRegistration`, `Touch.partnerRepId`).
  Shared pipeline = open opps a company's reps are on, or whose `partners` list names the company.
- **Smart lists.** Rules are `{ match: all|any, rules: [{ field, op, value }] }` validated by `RulesSchema`; fields per
  entity are declared in `src/lib/daily/smart-fields.ts` and evaluated in memory by `matches()` over `rowsFor(entity)`.
  Add a field = one `SMART_FIELDS` entry + its value in `rowsFor()`. Pinned lists appear in the sidebar (`PinnedLists`).
- **Quick capture** (`c`) saves a Note with `#tags` and offers each `Action:` / `Next:` / `TODO` / `- [ ]` line as a task.
- **Shortcuts** must be listed in the `?` overlay (`help-overlay.tsx`); G-sequences come from module commands.

## Phase 8 conventions (team-ready foundations)

- **Ownership.** Core tables carry `ownerId`, `teamId`, `createdBy`, `updatedBy` (defaults `"local"` / `"local-team"`).
  `db` is wrapped by `withTeamFoundations()` (`src/lib/db-extensions.ts`), which stamps them on create/update from
  `currentActor()` (`src/lib/auth/actor.ts`). The worker runs as `system` (records it creates are still owned by the
  local user). Add a new user-facing model to `OWNED_MODELS` (and the schema columns). The extension is a query
  extension cast back to `PrismaClient`, so callers keep the plain type.
- **Audit log.** `AuditLog` is append-only. Deletes of owned models are audited automatically by the extension
  (single-row deletes keep the record's label). Call `audit(db, { action, … })` for imports (`import.commit`/`undo`),
  enrichment decisions (`enrichment.accept|reject|manual`), exports (`export.create`), packs and plays. `audit()` never
  throws. UI: Team & sharing → Audit log (`/api/audit`, cursor-paginated).
- **Auth.** `getAuthProvider()` (`src/lib/auth/server.ts`): local single-user by default; `ACC_AUTH=sso` selects the SSO
  slot, which throws `AuthNotConfiguredError` until a hosted version is approved. Read the user with `currentUser()`.
  Teammates are `User` rows with names only (for @mentions and ownership), never contact details.
- **Roles & visibility** live in `src/config/roles.ts` (`VISIBILITY_FIELDS` → export field keys; `ROLES` → hidden keys).
  On screen: tag elements with `data-field="<key>"` (StatTile `field`, DataTable `meta.field`, opp `Field field`);
  `RoleChip` sets `html[data-role-hide]` and CSS hides them (`[data-field-notice]` shows a placeholder). Exports merge
  `exportHiddenFor(role)` as locked `roleHidden`; packs gate sections with `effectiveSections()`.
- **Comments** (`Comment`, `/api/comments`) on accounts and opportunities. Mentions are re-derived server-side from
  `@Display Name` tokens (`findMentions`, longest name first). A mention of the local user from someone else (e.g. in an
  imported pack) creates a `mention` notification. Only the author edits/deletes.
- **Shareable packs** (`acc-pack` v1, `src/lib/team/pack-schema.ts`). Export: chosen accounts + sections (profile
  fields with provenance, evidence, committee roles, optional names/tier/opps/amounts/notes/comments); demo accounts are
  refused. Import: preview matches (domain, then legal name) → merge/create/skip → one `ImportBatch` (kind `pack`) so
  Import → History can undo it. Profile values arrive as `FieldProposal`s (`enricherId: "pack"`) for review; evidence
  without a public link is stored as `user-hypothesis`; children, notes and comments are de-duplicated on re-import.
- **Play Library packs** (`acc-plays` v1): export all plays; import previews new / changed / identical and only
  replaces changed plays when asked (`origin: "imported"`).
- **Hosting** is a proposal only: `docs/TEAM_DEPLOYMENT.md`. Don't deploy or add hosting.

## Phase 9 conventions (polish and hardening)

- **Backups.** Every backed-up table is listed once in `src/lib/backup/tables.ts` (parents first); snapshot, restore
  and the coverage test read it, and the test fails if a Prisma model is neither listed nor deliberately excluded
  (HttpCache, JobRequest, SourceRun). **Add new models there.** Backup format `acc-backup` v3.
  - The worker writes `backups/auto-<ts>.json` once per calendar day (`backup.autoDaily`) and keeps the newest
    `backup.keep` (default 14) automatic ones (`runAutoBackup`, pure `toPrune` / `autoBackupDue`).
  - Restore (`restoreBackup`) replaces all backed-up tables in one transaction (`PRAGMA defer_foreign_keys`), writing
    `pre-restore-<ts>.json` first, rebuilding the search index after, and auditing it. Settings → Data → Backups &
    restore requires typing RESTORE. Backup names are validated (`backupPath`): only known prefixes inside `backups/`.
- **Performance.** `npm run test:db:seed:perf` (500 accounts, 2,000 opps, 50,000 signals; test DB only) and
  `npm run perf` (API + page timings → `perf-report.json`). Results and limits: `docs/PERFORMANCE.md`.
  - `handler()` gzips JSON responses ≥ 16 KB (route handlers aren't compressed by `next start`).
  - Kanban renders 50 cards per column with "Show more"; the health heatmap API returns the lowest 60 by default.
- **Accessibility.** axe runs WCAG 2.0/2.1 A + AA (`wcag21a` included, so label-in-name is checked) on populated pages
  (`e2e/phase4.spec.ts`) and on every page with zero records (`e2e/empty/00-empty-pages.spec.ts`). A control's
  accessible name must contain its visible text (e.g. "Present (Presentation Mode)").
- **Screenshots** cover every page in light and dark, populated (`screenshots/<theme>/*.png`) and empty
  (`screenshots/<theme>/empty-*.png`).

## Phase 10 conventions (deliverables engine)

- **Slides are planned, not hand-built.** `planSlides(doc, deckOptions)` (`src/lib/deck/plan.ts`, pure, tested) turns
  the redacted `ExportDocument` into slides with a layout each: kv → `kpis` (or `facts`), chart (+ the paragraph or
  callout after it) → `chart-takeaway`, table → paginated `table` (8 rows), list → `bullets` / `two-column`, callout →
  `quote`; level-3 headings title the slides after them; the cover becomes the title slide; a `*.next-steps` section
  becomes the closing slide. Slide ids (`<sectionId>:<n>`) are stable, so hidden slides and edited speaker notes
  (`config.deck.hiddenSlides` / `notes`) survive regeneration.
- **Takeaways are computed, never invented** (`narrative.ts`): leader + share, trend %, periods at target. A
  section's own sentence after a chart wins; the computed line goes to the speaker notes.
- **Renderers** draw the same layouts: `slidesToPptx()` (`src/lib/deck/pptx.ts`: master with logo/footer/slide
  numbers, native editable charts, notes) and `SlideView` (`src/components/deck/slide-view.tsx`, 1280×720 canvas) for
  the 16:9 PDF route `/print/deck/<id>`, builder thumbnails and the presenter. Change a layout in both.
  `withSlideCharts()` re-renders chart SVGs at slide aspect.
- **Theme**: `resolveDeckTheme("brand" | "neutral")` (`theme.server.ts`) reads the local brand pack (AA-adjusted
  primary + logo as a data URL); neutral otherwise. Chart series always use the validated palette.
- **Config**: `style` (`document` | `deck`; PPTX is always slides), `theme`, `deck` (agenda, dividers, closing,
  hiddenSlides, notes). Deck exports store `{ slides, theme }` in the snapshot.
- **Presenter** (`deck-presenter.tsx`) shows `audienceSlides()`: redaction marks removed, not outlined.
- **New sections**: `exports.exec-summary` (situation, public priorities with sources, where we can help),
  `exports.next-steps` (plan actions customer-safe; deal steps and tasks internal), `partners.co-sell` (internal).
  Built-in templates install by name, so new ones reach existing workspaces without touching saved ones.

## Phase 11 conventions (TCO / business cases)

- **Assumptions only.** Every cost is user-entered; templates (`src/lib/tco/templates.ts`) are structures with $0
  amounts (a unit test enforces it). The only pre-filled physical value is a typical PUE, labeled "replace with
  measured". Never add vendor or company pricing, rate cards or margins.
- **Model** (`src/lib/tco/model.ts`, Zod): years, discount rate, demand growth, baseline, ≤ 4 scenarios of cost lines.
  A line is `one-time` (amount in a year, 0 = upfront), `annual`, `power` (kW × utilization × 8,760 h × PUE × $/kWh) or
  `staff` (FTE × loaded cost), with % escalation and optional demand growth. `lineFormula()` explains each line in
  words; show it wherever a number appears.
- **Math is pure and tested** (`compute.ts`): cash flows per year, NPV, savings vs baseline, payback (fractional, 0 =
  immediate, null = not within period), IRR (bisection, only when the savings stream has an investment), and
  `sensitivity()` (±20% per line, energy price, PUE, ±5 pts growth, ±2 pts discount) returning swings vs `base`.
- **Charts** use `CHART_GROUPS` (8 fixed groups → fixed series colors); the tornado is diverging around the base case.
- **Storage**: `BusinessCase` (draft | final, linked to account and optionally an opportunity) and immutable
  `BusinessCaseVersion` snapshots. The editor autosaves valid edits (600 ms) and flushes before saving a version.
- **Export**: section `business-cases.tco` (latest final case, else latest) with headline, cumulative chart +
  takeaway, annual table, tornado, every assumption and an "estimate" callout; template "TCO business case deck".

## Phase 12 conventions (DC Sandbox)

- **Model** (`src/modules/sandbox/lib/spec.ts`, Zod, `version: 2`): one room on a 0.6 m tile grid; racks are 1 × 2
  tiles (x, y, rotation 0/180 = front down/up, height, cooling type, A/B or single feed, kW per feed, devices with U
  positions); cooling units (CRAH, in-row, CDU) are 2 × 1 tiles; room UPS kW, cooling redundancy (N, N+1, 2N), floor
  rating; assumptions (utilization, growth, horizon, air kW per rack). Older v1 specs open as an empty room
  (`readSpec`). Stored in `SandboxScenario.spec`; `baseId` links a what-if copy to its original.
- **Calculators are pure and explain themselves** (`lib/calc.ts`): device draw = max × (0.3 + 0.7 × utilization);
  heat split to air / liquid by device and rack cooling (DLC 80% to liquid, immersion 100%, rear-door HX up to 35 kW);
  per-rack limits by cooling type (`rackLimitKw`); feed load at nameplate; floor load; room capacity after redundancy
  (`effectiveCapacity`); PUE estimate (COP air 3 / liquid 8 + 6% losses + 2% other); `growth()` runway against the
  binding limit; `failures()` (lose each cooling unit, lose feed A); deterministic `telemetry()` for the **simulated**
  ops console. Every `Issue` has a severity and every room result carries `formulas`. Never present simulated
  telemetry as real.
- **Editors**: `useScenario()` keeps undo/redo history (100 steps; `commit` records, `preview` doesn't) and autosaves
  valid specs after 700 ms. Floor plan = SVG with drag + tile snapping, arrow keys / R / Delete, `canPlace()` collision
  checks. Heat bands (`heatBand`) always pair color with a text label.
- **3D** (`three-view.tsx`, react-three-fiber, loaded with `next/dynamic` `ssr: false`): labels are drei `<Html>`, not
  `<Text>` (which would fetch a font from a CDN). The camera rig animates ~70 frames after a preset change, then hands
  control back to OrbitControls.
- **Tour** captions and export text are computed from the scenario; nothing is invented.
- **Exports**: `sandbox.views` (floor plan + rack elevations as escaped SVG `image` blocks from `lib/svg.ts`) and
  `sandbox.capacity` (KPIs, growth chart + sentence, per-rack table, resilience). The `image` block renders in the
  document view, Markdown (alt text), the `image` slide layout and PPTX (SVG image).
- **Business case from a scenario**: `createCase({ sandboxId })` copies only physical drivers (IT kW, PUE) into the
  on-prem power lines; prices stay for the user.
- Templates (`lib/templates.ts`) must not overlap (unit-tested).

## Phase 13 conventions (data contract & local API)

- **Contract** (`src/lib/contract/schema.ts`, Zod, `format: "acc-data"`, `version: "1.x"`).
  - Entities: accounts, contacts, opportunities, activities (Touch), notes, tasks and partnerReps.
  - Every record has `externalId` / `accId` / `externalRefs`.
  - Account refs are `{ externalId | domain | name }`.
  - No email, phone, address, pricing or margin fields (a unit test checks property names).
  - Fields described "internal" are listed in `INTERNAL_FIELDS`.
  - `npm run contract:schema` regenerates `docs/contract/{acc-data-v1.schema.json,example.acc-data.json,openapi.json}`.
    A drift test fails if they're stale. **Change the schema → regenerate.**
- **Import** reuses the CSV pipeline.
  - `src/lib/contract/convert.ts` (pure) turns entities into `MappedRow`s.
  - `commitContract()` (`src/lib/server/contract/import.ts`) runs `commitImport({ groupId, quiet, inputType:
"contract" })` per kind. It then plans and applies activities and tasks itself (`activities.ts`, batch kind
    `"contract"`, records `touch` / `task`).
  - `ExternalRef` (system + entityType + externalId → entityId) keeps identity across re-imports. ACC's own files
    (`system "acc"`) use ACC ids directly.
  - Opportunities without `amount` keep the matched deal's amount.
  - `nextStepDate` is set through `updateOpportunity()`.
- **Undo.** `undoImport()` undoes every batch that shares a `groupId` (newest first) and deletes the `ExternalRef`s of
  rows it deleted.
- **Export** (`exportContract()`):
  - non-demo accounts only;
  - validated against the schema before redaction;
  - `redactContract()` applies `visibility` and the role's hidden keys (`opp.amount`, `opp.forecast`, `notes`).
  - A file labeled customer-safe that carries internal fields is refused on import.
- **Local API** (`src/lib/server/local-api.ts`, `/api/v1/*`):
  - GET only; setting `api.local` (off by default; token SHA-256 hash only). The generic `/api/settings/api.local`
    route returns 404.
  - Managed via `/api/local-api` (same-origin check); token on/off and generation are audited.
  - `requireApiToken()`: 403 when off, 401 on a missing or bad token. Add a v1 route by calling `v1List()` / `v1Account()`.
- **Boundary**: `docs/INTERNAL_PORT.md`. `private-future` keeps throwing; no connector to any company system; writes stay
  file-based with preview + undo.

## Phase 14 conventions (team value and polish)

- **Win / loss** (`src/lib/pipeline/trends.ts`, pure, tested). It is the Opportunities `view=win-loss` tab, computed
  client-side from the filtered rows like the other views:
  - won/lost and win rate per closing quarter;
  - won-deal cycle time;
  - win rate by practice;
  - creation-cohort conversion (from stage history or current stage);
  - recorded close reasons;
  - `winRateTakeaway()`, a computed sentence that stays silent below 3 closed deals per half.

  Counts only, no amounts.

- **Close reasons.** `Opportunity.closeReason` takes a value from `CLOSE_REASONS` (`enums.ts`). It is set only by the
  user (deal sheet, when the deal is closed) and cleared by `updateOpportunity()` when a deal reopens. Fixture reasons
  are derived from the close date (no RNG draw).
- **Mutual action plans** (`MutualActionPlan`, one per opportunity).
  - Steps are a JSON list validated by `MapStepsSchema` (`src/lib/map/model.ts`, pure, tested): side, owner as a role
    or name the user types, due date, status, customer-visible flag, internal note.
  - `starterSteps()` is a generic decision path (methodology, not account data) counted back from the target date.
  - `mapProgress()` gives health and a computed summary. `customerSteps()` is the customer view: visible steps only,
    no notes.
  - Server: `src/lib/server/action-plans.ts`; API `/api/opportunities/:id/plan` (GET/POST/PATCH/DELETE) and
    `/plan/pdf?audience=customer|internal`, which Playwright prints from `/print/plan/:id` and audits as
    `plan.export`.
  - Page: `/opportunities/:id/plan` (autosaves after 600 ms).
  - Export section `opportunities.action-plan`: internal notes and hidden steps are `internal` fields.
- **Team workspace** (module `team`, `/team`, `G W`).
  - **Workload:** open tasks per teammate (`Task.assigneeId` → `User.id`; null = you), reassignable inline.
  - **Territory plan:** every action plan by health, plus open account-plan items, overdue first.
  - **Weekly digest:** `buildDigest()` (`src/lib/team/digest.ts`, pure) over the last 7 days, plus closes and plan
    steps for the next 14. Amounts are omitted when the role hides `opp.amount`. Download with
    `/api/team-workspace/digest?format=md` (audited).
  - The task dialog has "Assign to" when teammates exist.
- **Shortcuts.** `G W` team, `G C` business cases, `G X` sandbox. ⌘K adds "Win / loss analytics", "Weekly team
  digest" and "Data contract & local API". All of them appear in the `?` overlay.

## Decisions log

- **Worker process (approved divergence).** Scheduling runs in a separate worker process, not inside Next. It talks
  to the app only through the DB (`JobRequest`, `Signal`, `SourceRun`). SSE will tail the DB by cursor (Phase 3).
- **ECharts only**, with no Recharts.
- **Contacts are user-entered.** `displayName` is typed or imported by the user; nothing is scraped. Approved for
  Phase 6: named executive officers from SEC filings (name + title + source link only) may be offered as Buying
  Committee _suggestions_ the user accepts one by one — never added automatically.
- **Module icons** are lucide components (`icon: LucideIcon`), as the spec specifies.
- **Fixture dates** are relative to "today", so test screenshots always look current. The content is deterministic
  (`SEED = "acc-demo-v1"`).
- **Demo badge removed (Phase 5, approved).** Replaced by the `DemoDataWarning` banner (real DB) and a `TEST DB` chip
  (test DB, `ACC_TEST_DB=1`).
- **XLSX parsing uses `exceljs`** (approved). The npm `xlsx` package is an abandoned release with known advisories.
- **Google News stays, opt-in per account** (approved). It has no official API; all other sources use official APIs.
  Bulk opt-in is one click from Live Signals → Source coverage or after an import.
- **AHEAD branding via local brand pack** (approved Nov 2026). Assets stay out of git; the public repo stays neutral.
- **Enrichers (Phase 6) verified live at build time (Nov 2026)**: SEC submissions/companyfacts/Archives, GLEIF
  lei-records (+ parent/children), dns.google JSON, Greenhouse/Lever/Ashby/SmartRecruiters posting APIs, PeeringDB
  org/net/netfac, USAspending spending_by_award (POST). Wikidata returned 429 from the shared cloud IP during the build,
  so its parser is fixture-tested against the documented entity JSON; it backs off on 429.
- **Round 3 approved (Nov 2026)** — `docs/ROUND3_PLAN.md`: deliverables engine → TCO → full Sandbox → data contract →
  team polish. TCO inputs are user-entered assumptions only (no company pricing or margins in the repo). The internal
  AI-tool port gets a neutral, file-based data contract; any live connection waits for company approval.
- **Prisma 6.19** (stable) is pinned. npm's `latest` tag for Prisma pointed at a 8.0 release candidate at build time.

## Phase status

- [x] Phase 0: plan
- [x] Phase 1: foundation (shell, registry, schema, seed, settings skeleton, search, worker skeleton)
- [x] Phase 2: Command Home grid + saved layouts, Account 360 (all tabs), Opportunities (Kanban, table, forecast, analytics), CSV import
- [x] Phase 3: public adapters, worker scheduler, SSE live feed, tagging/relevance editors, Live Signals, Demand Gen
- [x] Phase 4: exports, sandbox stub, Presentation Mode polish, performance and a11y pass, docs
- [x] Phase 5: demo data removed (test-DB fixtures, purge + backups), onboarding + empty states, import wizard
- [x] Phase 6: identity resolution + public-data enrichment engine (10 enrichers, review UI, queue)
- [x] Phase 7: My Day, meeting prep, triage, tasks, cadence, partners, fiscal timing, data quality, smart lists
- [x] Phase 8: team-ready foundations (ownership, auth abstraction, packs, audit log)
- [x] Phase 9: polish and hardening
- [x] Phase 10: deliverables engine (layouts, branded theme, templates, native charts, deck preview)
- [x] Phase 11: TCO / business-case builder
- [x] Phase 12: Data Center Sandbox (full)
- [x] Phase 13: data contract for the internal-tool port
- [x] Phase 14: team value and polish
