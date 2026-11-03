# Account Command Center — Phase 0 Plan

Status: **approved** (Phase 1 complete). Kept for reference; CLAUDE.md is the living source of conventions.

## 1. Goals (restated)

A local-first, single-user sales intelligence dashboard for an Associate Client Director at AHEAD.
It covers six jobs:

1. **Account intelligence** (Account 360)
2. **Live public signals** (SSE feed)
3. **Pipeline** (Kanban, table, forecast, MEDDPICC)
4. **Demand gen** (plays, recommender, campaigns, messages, events)
5. **Executive exports** (audience modes and redaction; PDF, Markdown, and a minimal PPTX)
6. **Data center sandbox** (stub only for now)

Everything is a self-registering **module**. The shell's sidebar, widget picker, export builder, settings and feature
flags are all generated from the module registry. All data is fictional seed data, user-entered data, or data
fetched from public sources, and every public item links to its source.

## 2. Assumptions

| #   | Assumption                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Single user, no auth. Runs on `localhost:3000`.                                                                                                                                                                                                                                                      |
| A2  | Next.js 16 (latest stable), React 19, Tailwind v4, shadcn/ui, and Prisma 6 on SQLite.                                                                                                                                                                                                                |
| A3  | Prisma enums aren't supported on SQLite, so enum-like columns are `String`, validated by shared Zod enums in `src/lib/domain/enums.ts`. This stays Postgres-compatible: they can become native enums later with no app changes.                                                                      |
| A4  | JSON columns (MEDDPICC, layouts, stage history detail, scoring weights) use Prisma `Json`, which works on both SQLite and Postgres.                                                                                                                                                                  |
| A5  | **ECharts is the only chart library.** One `<Chart>` wrapper, one theme generated from CSS tokens, and an accessible data-table fallback for every chart. Recharts is skipped to keep one visual system.                                                                                             |
| A6  | Contacts are **personas** (title, function, seniority, buying role). Seed personas use no person names, e.g. "VP Infrastructure". The user may type a name manually, and nothing is ever scraped.                                                                                                    |
| A7  | Real (CSV-imported) accounts get **no generated intelligence**. Initiatives and tech-stack hypotheses on real accounts come only from adapter evidence (with a source URL) or from user entry flagged `source = "user-hypothesis"`. This is enforced in the domain layer and covered by a unit test. |
| A8  | Practice-area taxonomy (editable): AI Infrastructure, Modern Data Center, Cloud, Data & Analytics, Security, Automation & Platform Engineering, Enterprise Service Management, Managed Services, Integration Facility (Foundry).                                                                     |
| A9  | Seed data uses a seeded PRNG (`seedrandom`, fixed seed) and covers 150 accounts, 600 opps (including closed won/lost history for win rate and cycle time), 15,000 signals, 2,000 touches, ~15 plays and ~20 events.                                                                                  |
| A10 | Currency is USD, the fiscal year is the calendar year, and the forecast target is user-set in Settings.                                                                                                                                                                                              |
| A11 | The only AI hook is an `AiProvider` interface with a `NullAiProvider`. No LLM calls in this build.                                                                                                                                                                                                   |

## 3. Key architecture decisions (and where I diverge from the spec)

1. **Scheduler runs as a separate worker process, not inside Next.** In-process cron inside Next dev duplicates jobs
   on every hot reload and doesn't survive serverless hosting later. Instead:
   - `npm run dev` uses `concurrently` to start `next dev` and `tsx src/worker/index.ts`.
   - The worker runs the adapters on schedule and writes `Signal` rows plus a `SourceRun` health row.
   - `/api/stream/signals` (SSE) tails the DB by cursor (`createdAt` and `id`) every ~3s and pushes new rows.
   - "Fetch now" inserts a `JobRequest` row that the worker picks up within a second or two.

   This is simple and robust, and it scales to Postgres `LISTEN/NOTIFY` or a queue later.

   _This is a small divergence from "in-process scheduler". Approve or veto._

2. **Full-text search goes behind a `SearchProvider` interface.** The SQLite implementation uses an FTS5 virtual
   table created by a raw-SQL migration step and kept in sync by triggers. A Postgres implementation can use
   `tsvector` later. The command palette and global search only talk to the interface.
3. **Server data flow:** Route handlers under `/api/*` return Zod-validated DTOs, and TanStack Query consumes them.
   Heavy lists (signals, opps, touches, accounts) use cursor or offset pagination with server-side filter and sort.
   Tables use TanStack Table with TanStack Virtual.
4. **Scoring and tagging are pure functions** in `src/lib/scoring/*` and `src/lib/tagging/*`. Weights and rules live
   in the `Setting` table, and every score returns `{ value, components[] }` so the UI can show the breakdown.
5. **Redaction is declared, not hard-coded.** Each `ExportSectionDefinition` declares its fields with a
   `visibility: "internal" | "customer-safe"` attribute. Customer-facing mode and Presentation Mode both run through
   the same `applyRedaction()` function, so one tested code path guards both.
6. **PDF exports** come from Playwright printing `/print/export/[jobId]`. Charts render server-side with ECharts SSR
   to SVG, so the output stays crisp at any resolution. Markdown uses the same section model. PPTX uses `pptxgenjs`
   with a title slide plus one slide per section.

## 4. Folder structure

```
/
├─ PROMPT.md  CLAUDE.md  README.md  .env.example  .gitignore
├─ docs/  ADDING_A_MODULE.md  PHASE0_PLAN.md  ARCHITECTURE.md
├─ prisma/  schema.prisma  migrations/  seed/ (index.ts, generators/*.ts, names.ts)
├─ e2e/  *.spec.ts  screenshots.spec.ts
├─ src/
│  ├─ app/
│  │  ├─ (shell)/layout.tsx              # sidebar, top bar, palette, notifications
│  │  ├─ (shell)/page.tsx                # Command Home
│  │  ├─ (shell)/[...module]/page.tsx    # registry-driven module routes
│  │  ├─ print/export/[jobId]/page.tsx   # print-only route for PDF
│  │  └─ api/  accounts/ opportunities/ signals/ plays/ touches/ events/ notes/
│  │          exports/ search/ settings/ sources/ stream/signals/ backup/
│  ├─ components/
│  │  ├─ ui/              # shadcn primitives
│  │  ├─ shell/           # Sidebar, TopBar, CommandPalette, NotificationCenter, DemoBadge
│  │  ├─ chart/           # <Chart>, theme, ChartDataTable fallback
│  │  ├─ data-table/      # virtualized table, saved views, CSV export
│  │  └─ states/          # Empty, Error, Skeleton
│  ├─ config/  theme.ts (wordmark, accent; ALL branding)  practice-areas.ts
│  ├─ lib/
│  │  ├─ db.ts  env.ts (Zod-validated env)
│  │  ├─ domain/          # enums.ts, schemas (Zod DTOs)
│  │  ├─ scoring/         # health, whitespace, relevance, meddpicc, deal-risk
│  │  ├─ tagging/         # rules engine
│  │  ├─ redaction/
│  │  ├─ search/          # SearchProvider + sqlite-fts
│  │  ├─ adapters/        # types.ts, http (rate-limit/backoff/cache), dedupe
│  │  ├─ ai/              # AiProvider + NullAiProvider
│  │  └─ export/          # pdf, markdown, pptx renderers
│  ├─ modules/
│  │  ├─ types.ts  registry.ts  (auto-collected via an index generated by script, see below)
│  │  ├─ command-home/  account-intel/  signals/  opportunities/
│  │  ├─ demand-gen/    exports/        sandbox/  settings/
│  │  └─ <id>/ { module.ts, components/, hooks/, adapters/, export-sections.ts, __tests__/ }
│  ├─ stores/            # Zustand: ui, layout, presentation-mode
│  └─ worker/            # scheduler, job runner, adapter execution
└─ scripts/  gen-module-index.ts  screenshots.ts
```

**"Add a module by creating one folder":** a tiny `scripts/gen-module-index.ts` (run on `predev` and `prebuild`)
globs `src/modules/*/module.ts` and writes `src/modules/_generated.ts`. You never hand-edit the registry, and the
build stays fully typed with no runtime filesystem reads.

## 5. Prisma schema (draft)

```prisma
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model Account {
  id String @id @default(cuid())
  name String
  domain String?
  ticker String?
  cik String?                       // SEC CIK, resolved from ticker
  industry String
  subIndustry String?
  hq String?
  employeeBand String?
  revenueBand String?
  tier String                       // Strategic | Growth | Maintain
  ownerNotes String?
  healthScore Float @default(0)
  whitespaceScore Float @default(0)
  isDemo Boolean @default(false)
  sourceConfig Json?                // { googleNews: true, greenhouseSlug?, leverSlug?, rssFeeds: [] }
  lastTouchAt DateTime?
  nextTouchAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  contacts Contact[]
  initiatives Initiative[]
  techStack TechStackHypothesis[]
  signals Signal[]
  opportunities Opportunity[]
  touches Touch[]
  practiceStatus AccountPracticeStatus[]
  plan AccountPlanItem[]
  eventInvites EventInvite[]
  @@index([tier])
  @@index([name])
}

model AccountPracticeStatus {      // whitespace map cell
  id String @id @default(cuid())
  accountId String
  practiceArea String
  status String                     // NotEngaged | Exploring | ActiveOpp | Delivered
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@unique([accountId, practiceArea])
}

model Contact {
  id String @id @default(cuid())
  accountId String
  title String
  function String
  seniority String
  buyingRole String                 // EconomicBuyer | Champion | Technical | Influencer | Blocker
  displayName String?               // user-entered only, never scraped
  reportsToId String?
  engagement String?                // None | Light | Engaged | Strong
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model Initiative {
  id String @id @default(cuid())
  accountId String
  title String
  description String?
  practiceAreas Json                // string[]
  source String                     // signal | filing | job-post | user-hypothesis | seed
  sourceUrl String?
  signalId String?
  confidence Float                  // 0..1
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model TechStackHypothesis {
  id String @id @default(cuid())
  accountId String
  category String
  technology String
  evidence String
  sourceUrl String?
  source String
  confidence Float
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model Signal {
  id String @id @default(cuid())
  accountId String
  type String                       // news | filing | earnings | exec-change | hiring | m&a | funding | ...
  title String
  summary String?
  url String?
  source String                     // adapter id
  publishedAt DateTime
  dedupeHash String @unique         // sha1(url + normalized title)
  practiceTags Json                 // string[]
  relevance Float
  relevanceParts Json               // { recency, sourceWeight, practiceMatch, tier }
  read Boolean @default(false)
  starred Boolean @default(false)
  dismissed Boolean @default(false)
  inNextSummary Boolean @default(false)
  isDemo Boolean @default(false)
  createdAt DateTime @default(now())
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId, publishedAt])
  @@index([publishedAt])
  @@index([relevance])
  @@index([createdAt])
}

model Opportunity {
  id String @id @default(cuid())
  accountId String
  name String
  practiceArea String
  stage String                      // Qualify | Discover | Solution | Proposal | Negotiate | ClosedWon | ClosedLost
  amount Float
  closeDate DateTime
  probability Int
  forecastCategory String           // Pipeline | BestCase | Commit | Closed | Omitted
  nextStep String?
  meddpicc Json                     // { metrics, economicBuyer, decisionCriteria, decisionProcess,
                                    //   paperProcess, identifyPain, champion, competition }: { status, notes }
  partners Json                     // string[]
  competitors Json                  // string[]
  closeDatePushes Int @default(0)
  stageChangedAt DateTime
  sourceSignalId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDemo Boolean @default(false)
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  stageHistory StageChange[]
  @@index([stage])
  @@index([closeDate])
  @@index([accountId])
}

model StageChange {
  id String @id @default(cuid())
  opportunityId String
  fromStage String?
  toStage String
  changedAt DateTime @default(now())
  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
}

model Play {
  id String @id @default(cuid())
  name String
  practiceArea String
  targetPersonas Json
  triggerKeywords Json
  triggerSignalTypes Json
  valueHypothesis String
  talkTrack Json                    // string[]
  sequence Json                     // [{ day, channel, description }]
  assetsNeeded Json
  successMetrics Json
  isDemo Boolean @default(false)
  campaigns Campaign[]
}

model Campaign {
  id String @id @default(cuid())
  name String
  accountId String?
  playId String?
  status String
  startDate DateTime
  play Play? @relation(fields: [playId], references: [id])
  touches Touch[]
}

model Touch {
  id String @id @default(cuid())
  accountId String
  campaignId String?
  channel String                    // email | linkedin | call | meeting | event | briefing
  persona String
  angle String?
  scheduledAt DateTime
  completedAt DateTime?
  outcome String?                   // none | replied | meeting | opp-created | no-response
  sourceSignalId String?
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  campaign Campaign? @relation(fields: [campaignId], references: [id])
  @@index([accountId, scheduledAt])
}

model Event {
  id String @id @default(cuid())
  name String
  kind String                       // conference | webinar | partner | briefing | roundtable
  startsAt DateTime
  location String?
  invites EventInvite[]
}

model EventInvite {
  id String @id @default(cuid())
  eventId String
  accountId String
  persona String?
  status String                     // planned | invited | registered | attended | followed-up
  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model AccountPlanItem {
  id String @id @default(cuid())
  accountId String
  kind String                       // objective | strategy | action
  parentId String?
  text String
  owner String?
  dueDate DateTime?
  status String @default("open")
  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model Note {                        // polymorphic link
  id String @id @default(cuid())
  entityType String                 // account | opportunity | signal | play | event
  entityId String
  body String                       // TipTap JSON serialized, plus plaintext for FTS
  bodyText String
  internalOnly Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([entityType, entityId])
}

model ActivityLog {
  id String @id @default(cuid())
  entityType String
  entityId String
  action String
  summary String
  diff Json?
  createdAt DateTime @default(now())
  @@index([createdAt])
}

model SavedView   { id String @id @default(cuid()); scope String; name String; config Json }
model DashboardLayout { id String @id @default(cuid()); name String @unique; widgets Json; isDefault Boolean @default(false) }
model Setting     { key String @id; value Json }
model Notification { id String @id @default(cuid()); kind String; title String; href String?; read Boolean @default(false); createdAt DateTime @default(now()) }

model SourceRun   { id String @id @default(cuid()); adapterId String; startedAt DateTime; finishedAt DateTime?; ok Boolean; itemsNew Int; error String? ; @@index([adapterId, startedAt]) }
model JobRequest  { id String @id @default(cuid()); kind String; payload Json?; status String @default("pending"); createdAt DateTime @default(now()) }
model HttpCache   { key String @id; body String; etag String?; fetchedAt DateTime }

model ExportTemplate { id String @id @default(cuid()); name String; config Json }
model ExportJob   { id String @id @default(cuid()); templateId String?; config Json; format String; status String; outputPath String?; version Int; createdAt DateTime @default(now()) }

model SandboxScenario { id String @id @default(cuid()); name String; accountId String?; spec Json; createdAt DateTime @default(now()) }
```

## 6. Scoring formulas (transparent and adjustable)

- **Health (0–100)** is a weighted mean of six dimensions:
  - engagement recency (days since last touch)
  - persona coverage (share of the 5 buying roles covered)
  - pipeline momentum (stage changes in the last 30 days)
  - signal activity (count of relevant signals in the last 30 days)
  - opp quality (average MEDDPICC completeness)
  - risk (share of open opps with risk flags, inverted)
- **Whitespace (0–100):** `Σ practice weight × gap`, where gap is 1 for NotEngaged, 0.6 for Exploring, 0.2 for ActiveOpp and 0 for Delivered. The result is boosted by initiatives and signals that match each practice.
- **Signal relevance** = `recency decay (half-life 7d) × source weight × practice match (0.4 + 0.6 × matched/total) × tier factor (Strategic 1.0 / Growth 0.8 / Maintain 0.6)`, scaled to 0–100.
- **MEDDPICC completeness:** 8 fields, each scored 0 / 0.5 / 1, shown as a percentage. Red flags fire when there is no Economic Buyer, no Champion, or no Decision Process at Proposal or later.
- **Deal risk flags:**
  - stalled: no stage change in N days (default 30)
  - close date pushed 2 or more times
  - missing Economic Buyer
  - MEDDPICC below 50%
  - close date in the past

## 7. Concerns and things I need from you

1. **Persistence (most important).** This is an ephemeral cloud container with no git remote. Local commits are lost
   when the session is reclaimed. Please either give me a GitHub repo (owner/name) to push to after each phase, or
   confirm you'll download the code yourself.
2. **Public sources from this container.** Outbound traffic goes through a proxy. Google News RSS, SEC EDGAR,
   Greenhouse, Lever and GDELT may or may not be reachable here. Adapters will be built and unit-tested against
   recorded fixtures either way. Live verification happens only where the network allows, and I'll report which
   sources were actually exercised.
3. **`SEC_USER_AGENT`.** EDGAR requires contact info. I won't hardcode your email. Set it in `.env.local`; if it's
   missing, the adapter shows "not configured".
4. **Google News RSS** is an unofficial endpoint. Rate-limit it conservatively (1 request every 2s, cached 30 min) and
   use it for personal research only. GDELT will be off by default.
5. **Scale of the build.** Phases 1–4 are large. I'll stop after each phase with checks green, as specified. Expect
   Phase 2 and Phase 3 each to be a substantial chunk of work.
6. **The real account used for the definition of done.** I'll include `examples/target-accounts.csv` with a couple
   of well-known public companies purely as an import example. They're enriched only from public adapters, with no
   generated intelligence. Tell me if you'd rather supply your own.

**Approve as-is, or tell me what to change:** worker-process scheduler, ECharts-only, persona-only contacts, and the
repo for pushes.
