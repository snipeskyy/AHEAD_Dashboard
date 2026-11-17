# Handing ACC to another AI tool

This guide moves the **Account Command Center** code to a different AI assistant (for example your company's
internal AI tool), so it can keep developing ACC. It is written for you and for that assistant.

## 1. Before you hand it over

- **Check the tool is approved for source code.** The code contains no customer or internal data, but your company
  decides which AI tools may read code.
- **Make the GitHub repository private** (Settings → General → Danger Zone → Change visibility), or move it to your
  company's Git.
- **Package only the code:**

  ```bash
  npm run handoff
  ```

  This writes `handoff/acc-<date>-<commit>.zip` from the last commit, so commit your work first.
  - **Included:** source code, tests, docs and fictional test fixtures.
  - **Never included:** your database, backups, exports, `.env.local` (keys), the brand pack and screenshots. The
    script checks the zip and refuses if anything sensitive slipped in.
  - Your own ACC data stays on your computer. Move it separately, if at all, with an encrypted backup
    (Settings → Data & backup) plus your `ACC_BACKUP_KEY`.

**Tool won't accept a .zip?** Run `npm run handoff:text` instead. It writes plain `.txt` files to
`handoff/text/`:

- `acc-00-START-HERE.txt` holds the instructions, the AI context and an index of the parts.
- About 11 part files of at most 380 KB each hold the code by area. Set `ACC_HANDOFF_MAX_KB` for a different size.
- Each source file sits between `BEGIN FILE` / `END FILE` markers. The rebuild script in START-HERE recreates the
  folder byte for byte.

## 2. Load it into the tool

| Kind of tool                                                                                   | What to do                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AI coding assistant** (reads a repository: Copilot, Cursor, Codex, an internal coding agent) | Import the zip or the Git repo. It reads the rules automatically from `AGENTS.md`, `.github/copilot-instructions.md` or `.cursor/rules/acc.mdc` (all generated from `CLAUDE.md`). If it doesn't, start with: "Read AGENTS.md and docs/HANDOFF.md before doing anything." |
| **Chat assistant** (no repository access, limited memory)                                      | Paste `docs/AI_CONTEXT.md` as the system prompt or first message. Then attach only the files for the task at hand (the folder map says where). Never paste `.env.local`, backups or real data.                                                                           |
| **Agent platform** (builds agents from instructions + knowledge sources)                       | Use `docs/AI_CONTEXT.md` as the agent's instructions and add the repository (or the zip's contents) as a knowledge source.                                                                                                                                               |

## 3. Check it understood (first prompt)

```
Read AGENTS.md (or the context I gave you). Then, before changing anything:
1. List the six non-negotiable rules in your own words.
2. Say which command proves a change is safe, and what "done" means for a phase in this repo.
3. Explain how data from an AI tool enters ACC and why nothing is applied automatically.
```

Expect these answers:

1. **Rules:** no internal data in the repo; no demo data at runtime; public sources only for intel; no brand assets in
   the repo; local and private; no CRM connectors.
2. **Proof and "done":** `npm run check` + build + e2e. A phase is done when screenshots are reviewed, docs are
   updated, and the work is committed.
3. **Inbound data:** the data contract review queue.

## 4. Run it

```bash
npm install && npm run setup     # creates .env.local + ACC_BACKUP_KEY, migrates, locks file permissions
npm run dev                      # http://localhost:3000 (web + worker), bound to 127.0.0.1
```

PDF exports need a browser once:

```bash
npx playwright install chromium
```

## 5. Where things are

- **`CLAUDE.md` is the source of truth** for rules, conventions, the folder map and every phase's decisions.
  `AGENTS.md`, `.github/copilot-instructions.md` and `.cursor/rules/acc.mdc` are copies.
  - Edit `CLAUDE.md`, then run `npm run agents:sync`. A test fails if the copies drift.
- **Specs and plans:** `PROMPT.md`, `PROMPT_ROUND2.md`, `docs/PHASE0_PLAN.md`, `docs/ROUND3_PLAN.md`.
- **How-to guides:**
  - `docs/ADDING_A_MODULE.md` and `docs/ADDING_AN_ENRICHER.md`
  - `docs/DATA_CONTRACT.md` and `docs/GLEAN.md`
  - `docs/INTERNAL_PORT.md` and `docs/TEAM_DEPLOYMENT.md`
  - `docs/PERFORMANCE.md`
- **Stack:**
  - Next.js 16 (App Router; route `params` is a Promise), React 19, TypeScript strict, Tailwind v4, shadcn/ui.
  - TanStack Query + Zustand, Prisma 6.19 on SQLite.
  - Zod 4, ECharts, pptxgenjs, Playwright, Vitest, react-three-fiber.

## 6. Rules the new assistant must keep

1. Never put customer, internal or personal data in the repo. Fixtures are fictional, with `.example` domains.
2. Internal data enters only through the **review queue**. The contract has no email, phone, address, pricing or
   margin fields.
3. Every route handler is wrapped in `handler()`, which adds the same-origin write check, errors and gzip. Don't
   bypass it.
4. The app binds to `127.0.0.1`. The local API is off by default, and the staging API is a separate switch.
5. Backups are encrypted (`ACC_BACKUP_KEY`). New Prisma models go in `src/lib/backup/tables.ts` and, if
   user-facing, in `OWNED_MODELS`.
6. Use `npm run db:migrate -- --name x` for schema changes, never raw `prisma migrate dev`.
7. Scores and takeaways are computed and explainable; nothing is invented about real companies.
8. Charts use the validated palette and get a table fallback; there are no dual axes. Status colors always come
   with an icon and a label.
9. Customer-audience exports drop every `internal` field. Role visibility applies on screen and in exports.
10. `private-future` and `crm-placeholder` keep throwing. Don't build CRM connectors without approval.

## 7. How to check a change

```bash
npm run check                                   # typecheck + lint + unit tests (~226)
NEXT_DIST_DIR=.next-build npm run build         # production build
npm run e2e                                     # Playwright on the test database (~220 tests, incl. axe)
npm run screenshots                             # light/dark screenshots into screenshots/
```

E2E tests and screenshots use a separate test database (`prisma/test.db`) with fictional fixtures; they never touch
real data.

## 8. Known limitations and next work

| Area                | Today                                                                                                                                                    | Next step                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Role visibility     | Enforced in exports, packs and the contract; on screen it is hidden with CSS, so the browser still receives the fields (fine for single-user local use). | Enforce on the server before any shared/hosted use.                                    |
| Multi-user          | Single user per install. The SSO slot exists; teammates are names only.                                                                                  | Hosted deployment with SSO, row-level access and Postgres (`docs/TEAM_DEPLOYMENT.md`). |
| Database encryption | The live SQLite file relies on disk encryption (FileVault); backups are AES-256-GCM.                                                                     | SQLCipher or Postgres with encryption at rest when hosted.                             |
| Contract import     | Contacts and opportunities dedupe by name, so a renamed record imports as new. Undo doesn't restore a changed next-step date.                            | Match on `ExternalRef` first.                                                          |
| Live Glean path     | The staging API exists but needs a hosted, approved deployment.                                                                                          | Host behind SSO, then turn on staging.                                                 |
| Dev-tool advisories | `npm audit --omit=dev` is clean; eslint and shadcn CLI advisories remain.                                                                                | Upgrade with the next major tooling bump.                                              |

## 9. Starter prompts

- **Add a feature:** "Using the module conventions in AGENTS.md, add <feature> as a module under `src/modules/<id>`
  with exportSections, an e2e test with axe, light/dark screenshots, and docs. Run npm run check and the e2e suite."
- **Change the data model:** "Add <field> to <model>. Use npm run db:migrate, update backup tables and OWNED_MODELS
  if needed, the data contract (then npm run contract:schema) and tests."
- **Review security:** "Review the last commit against the non-negotiable rules and the Phase 15 conventions; list
  violations with file:line."
