# Performance (Phase 9)

Measured with `npm run perf` against a production build (`next start`) on the **test database** seeded with the
performance profile: `npm run test:db:seed:perf` → **500 accounts, 2,000 opportunities, 50,000 signals, 6,700 touches**,
plus enrichment-style profile fields on every account. The real database is never used. Machine: the cloud build
container (shared vCPUs), so a laptop is typically faster. Median of 5 warm runs.

## How to reproduce

```bash
npm run test:db:seed:perf
NEXT_DIST_DIR=.next-build npm run build
NEXT_DIST_DIR=.next-build node scripts/with-test-db.mjs npx next start -p 3100   # in another terminal
npm run perf             # writes perf-report.json (git-ignored)
npm run test:db:seed     # back to the normal fixture size for e2e
```

## Changes made in this pass

| Problem at 500 accounts                                                  | Fix                                                                                  | Result                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Route-handler JSON was sent uncompressed (`/api/opportunities` = 1.3 MB) | `handler()` gzips JSON ≥ 16 KB when the client accepts it (`src/lib/server/http.ts`) | 1.3 MB → 120 KB on the wire (matters for LAN users) |
| Health heatmap scored every account (296 ms, 322 KB)                     | API returns the lowest-health 60 (`?limit=`), which is more than a widget shows      | 296 ms → 32 ms, 39 KB                               |
| Kanban rendered every open deal (~1,300 cards)                           | 50 cards per column with "Show more"; deals moved in the last hour sort first        | `/opportunities` settles in 1.2 s (was 2.0 s)       |

## API latency (after)

| Endpoint                       | Median ms | p95 ms | KB (uncompressed) |
| ------------------------------ | --------: | -----: | ----------------: |
| `/api/meta`                    |        12 |     18 |                 0 |
| `/api/accounts`                |        44 |     61 |               212 |
| `/api/opportunities`           |       238 |    262 |              1283 |
| `/api/signals?limit=50`        |        12 |     22 |                31 |
| `/api/my-day`                  |       162 |    174 |                13 |
| `/api/territory`               |        76 |     82 |               216 |
| `/api/fix-it`                  |        30 |     41 |                 0 |
| `/api/enrichment/overview`     |        30 |     37 |                 0 |
| `/api/tasks?status=open`       |         7 |      8 |                 0 |
| `/api/partners`                |        28 |     31 |                 1 |
| `/api/pipeline`                |        96 |     99 |                 4 |
| `/api/dashboard/next-actions`  |       168 |    202 |                 3 |
| `/api/dashboard/health-matrix` |        37 |     56 |                39 |
| `/api/search?q=gpu`            |        11 |     14 |                 4 |
| `/api/audit?limit=50`          |         7 |      9 |                 0 |

## Page loads (after)

"Heading" = navigation until the page's first `<h1>` renders; "idle" = until the network is quiet (all widgets loaded).

| Page                            | Heading ms | Idle ms |
| ------------------------------- | ---------: | ------: |
| `/`                             |        447 |    1002 |
| `/dashboard`                    |        235 |    1357 |
| `/accounts`                     |        140 |     922 |
| `/accounts/demo-acc-008`        |        232 |     835 |
| `/opportunities`                |        213 |    1176 |
| `/opportunities?view=table`     |        132 |    1023 |
| `/opportunities?view=analytics` |        103 |    1040 |
| `/signals`                      |        119 |     867 |
| `/signals?tab=triage`           |        122 |     798 |
| `/territory`                    |        153 |    1052 |
| `/tasks`                        |        176 |     759 |
| `/lists`                        |        131 |     972 |
| `/share`                        |        110 |     746 |

## Notes and limits

- Opportunities (2,000) and accounts (500) still load once and filter client-side (Phase 2 convention); at this size
  that is ~200 ms server time and well under a second end to end. Beyond ~10,000 deals, move the table to server-side
  pagination like Signals.
- Signals are cursor-paginated (50 per page) and stay ~10 ms regardless of volume; search (FTS5) stays ~10 ms.
- My Day (~130 ms) and next-best-actions (~130 ms) are the heaviest aggregate endpoints; both are dominated by
  scoring all open deals and accounts, which is linear and fine at this scale.
