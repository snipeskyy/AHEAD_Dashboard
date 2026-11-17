# ACC: context for an AI assistant (compact)

Paste this as the system prompt (or first message) when the assistant can't read the whole repository. The full,
authoritative rules are in `CLAUDE.md` / `AGENTS.md`; ask for the relevant section when you need detail.

## What you're working on

**Account Command Center (ACC)** is a local-first sales-intelligence dashboard for an enterprise account director
and a few teammates. Each person runs it on their own computer.

It covers:

- My Day, accounts (Account 360), opportunities (board, forecast, analytics, win/loss), signals from public sources;
- enrichment from public data, demand gen, tasks, territory, partners;
- exports to documents, PDF and PPTX decks;
- TCO business cases, a data-center sandbox (floor plan, 3D, capacity), mutual action plans, a team workspace;
- a data contract for importing account data from the company AI tool (Glean) through a review queue.

**Stack:** Next.js 16 App Router (route `params` is a Promise), React 19, TypeScript strict, Tailwind v4,
shadcn/ui, TanStack Query, Zustand, Prisma 6.19 on SQLite, Zod 4, ECharts, pptxgenjs, Playwright, Vitest.
A separate worker process (`src/worker`) runs scheduled jobs; it talks to the app only through the database.

## Non-negotiable rules

1. **The repository never contains** customer, internal or personal data, CRM exports, pricing, margins or
   contracts. Fixtures are fictional (`.example` domains, `isDemo = true`, test database only).
2. **Internal data reaches a user's local ACC only through the data-contract review queue.**
   - Paste/upload, or `POST /api/v1/staged-imports` (off by default).
   - A person reviews every change before applying it.
   - The contract has no email, phone, address, pricing or margin fields. Don't add them.
3. **Real accounts get intelligence from public sources only.** Every item has a public `sourceUrl` or is marked
   `user-hypothesis`. Never invent facts about real companies.
4. **No third-party brand assets in the repo.** Company branding comes from a local, git-ignored `brand/` pack.
5. **Local and private:**
   - no telemetry;
   - secrets only in `.env.local`;
   - the app binds to `127.0.0.1`;
   - every write passes the same-origin check in `handler()`;
   - backups are AES-256-GCM encrypted.
6. **No CRM or marketing-automation connectors.** `private-future` / `crm-placeholder` keep throwing.

## How code is organized

- **Modules:** `src/modules/<id>/module.ts` (auto-discovered) plus `pages/`, `components/`, `widgets/` and
  `export.server.ts`. Every module declares `exportSections`.
- **API:** `src/app/api/**/route.ts`, Zod-validated and always wrapped in `handler()` from `src/lib/server/http.ts`.
- **Pure logic with unit tests:**
  - `src/lib/**`: scoring, pipeline analytics and trends, TCO, the deck planner, the MAP model, the contract;
  - `src/modules/sandbox/lib`: sandbox calculators.
- **Writes go through their owners:**
  - opportunities → `updateOpportunity()`;
  - signals → `ingestSignals()`;
  - enrichment → `src/lib/enrich/store.ts`;
  - imports → `planImport` / `commitImport` / `undoImport`;
  - contract files → `src/lib/server/contract/*`.
- **Settings:** a typed registry in `src/lib/settings/schema.ts`.
- **Enum-like strings:** validated with `src/lib/domain/enums.ts`.
- **Schema changes:**
  - Run `npm run db:migrate -- --name x`, never raw `prisma migrate dev`.
  - Add the model to `src/lib/backup/tables.ts`, and to `OWNED_MODELS` if user-facing.
  - If the contract changes, run `npm run contract:schema`.

## UI conventions

- **Charts:** the ECharts wrapper only, with the validated palette (never the accent color); no dual axes; every
  chart has a table fallback. Build font sizes from `t.fs`.
- **Accessibility:** every control has a visible focus state and an accessible name containing its visible text.
  Status colors come with an icon and a label.
- **Presentation Mode** hides `data-internal-only` UI.
- **Exports:** customer audience drops every `internal` field. Roles hide fields on screen and in exports.
- **React compiler rules:** no `setState` in effects, no `Date.now()` in render, `useMounted()` for client-only
  values.
- Keep files under ~300 lines.

## Definition of done

1. `npm run check` (typecheck + lint + unit tests) passes.
2. `NEXT_DIST_DIR=.next-build npm run build` passes.
3. `npm run e2e` passes (test database only; axe a11y included). Add e2e tests for new screens, plus light/dark
   screenshots and empty-state checks.
4. Docs updated: the `CLAUDE.md` phase conventions (then `npm run agents:sync`), README, and the relevant `docs/*`.
5. Commit; the pre-commit guard blocks data, keys and brand files. Never commit `.env.local`, databases, backups or
   exports.

Ask before diverging from these rules or the specs, and before anything hard to reverse.
