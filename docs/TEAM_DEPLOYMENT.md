# Team deployment (proposal only)

> **Status: proposal.** Nothing here is built or hosted. ACC stays a local, single-user app until the company
> approves a hosted version (spec Phase 8: "build the structure, don't host"). This document describes the path so the
> team can share ACC later **without a rewrite**, and lists the decisions that need approval first.

## 1. What already exists (Phase 8 foundations)

| Foundation                     | Where                                                                                                                              | What it gives the hosted version                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Ownership metadata             | `ownerId`, `teamId`, `createdBy`, `updatedBy` on every core table; stamped by `withTeamFoundations()` (`src/lib/db-extensions.ts`) | Row-level scoping and "who changed this" without a schema rewrite  |
| Actor context                  | `src/lib/auth/actor.ts` (`runAs`, `currentActor`, worker = `system`)                                                               | Each request runs as its signed-in user; all writes are attributed |
| Auth abstraction               | `AuthProvider` (`src/lib/auth/provider.ts`), local provider + an `sso` slot that throws until configured (`ACC_AUTH=sso`)          | SSO plugs in at one seam; callers already use `currentUser()`      |
| Roles & field visibility       | `src/config/roles.ts`, applied on screen (`data-field` + `data-role-hide`), in exports (`roleHidden`) and packs                    | The same config drives server-side redaction later                 |
| Comments & @mentions           | `Comment` table, `src/lib/server/comments.ts`                                                                                      | Become real-time team threads once users are real accounts         |
| Audit log                      | `AuditLog` (imports, enrichment decisions, exports, packs, plays, deletes)                                                         | Compliance trail; ships to the company log pipeline                |
| Shareable packs / Play Library | `src/lib/server/packs/*`                                                                                                           | The interim way to share, and a migration format                   |

## 2. Target architecture

```
 Browser ──HTTPS──► Reverse proxy / ingress (TLS, company SSO session)
                        │
                        ├─► ACC web (Next.js, N stateless replicas)
                        │       │  AuthProvider = SSO (OIDC)
                        │       │  runAs(user) per request
                        │       ▼
                        │    PostgreSQL (managed, encrypted, PITR backups)
                        │       ▲
                        └─► ACC worker (1 replica; adapters + enrichment queue, actor = system)
                                │
                                └─► public sources only (SEC, GLEIF, job boards, …) through an egress allow-list
 Object storage (exports/, backups/) — private bucket, lifecycle rules
```

- **Web**: the existing Next.js app, built with `npm run build`, run as a container. Stateless; scale horizontally.
- **Worker**: the existing `src/worker` process, one replica (the scheduler and queue assume a single runner; a
  Postgres advisory lock would guard it if a second replica ever starts).
- **Database**: PostgreSQL 16+. The schema is already Postgres-compatible (String enums, `Json` columns,
  `tagIndex` "contains" filtering instead of JSON-array filters).
- **Files**: `exports/` and `backups/` move from local disk to a private object-storage bucket.

## 3. Database: SQLite → PostgreSQL

1. Change `datasource db { provider = "postgresql" }` and create a fresh baseline migration (Prisma migrations are
   provider-specific; the SQLite history stays for the desktop build).
2. Replace the SQLite FTS5 provider with a Postgres implementation of `SearchProvider` (`src/lib/search`), using a
   `tsvector` column + GIN index per entity. The interface already isolates this.
3. Add composite indexes on `(teamId, …)` for the hot queries (accounts, opportunities, signals by account).
4. Move data with the existing JSON snapshot (`npm run db:backup` → importer script), or have each user import a
   **pack** of their accounts into the shared instance (dedupe by domain/legal name already exists).

## 4. Identity and access

- **SSO**: implement `ssoAuthProvider` with OIDC (authorization-code + PKCE) against the company identity provider.
  Map IdP groups → `User.role` and `User.teamId`. No passwords are stored by ACC.
- **Per-request actor**: a request wrapper resolves the session, then `runAs({ id, teamId }, handler)`. The ownership
  extension already stamps every write from that context.
- **Row-level scoping**: add a `scope` step to the db extension (or Postgres row-level security keyed on a session
  variable) so reads are limited to the user's team. Accounts are owned by one user and visible to their team.
- **Server-side redaction**: today roles hide fields in the UI and strip them from exports/packs. Hosted, the same
  `hiddenFor(role)` map must also strip fields from API responses (amounts, MEDDPICC, notes, …).
- **Mentions** notify the mentioned user (in-app first; e-mail only through an approved company channel).

## 5. Deployment options

| Option                                                                              | Fit                                | Notes                                                            |
| ----------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| A. Company-managed VM + Docker Compose (web, worker, Postgres)                      | Smallest pilot (one team)          | Fastest to stand up; backups and patching are on the owner       |
| B. Company container platform (Kubernetes / managed app service) + managed Postgres | Recommended for more than one team | Health checks, rolling deploys, managed backups, secrets manager |
| C. Keep desktop installs, share via packs                                           | Today's model                      | No infrastructure; no live collaboration                         |

Whatever is chosen: TLS everywhere, secrets in the platform's secret manager (not `.env` files), the outbound
egress allow-list limited to the public sources in `src/lib/adapters` and `src/lib/enrich`, and logs/audit shipped to the
company's log pipeline. Telemetry stays off.

## 6. Data and policy (must be approved before any hosting)

- **Classification**: the hosted database will hold user-entered account knowledge (notes, MEDDPICC, deal amounts).
  It must be approved for that data class, in an approved region, by security/compliance.
- **Still no CRM or internal-system integration** until approved separately (the `private-future` adapter keeps
  throwing). Public-source rules (official APIs, robots.txt, no login-walled sites, no personal contact details) are
  unchanged.
- **Retention**: audit log retained per company policy; backups with point-in-time recovery; exports expire.
- **Access reviews**: role and team membership come from the IdP, so leavers lose access automatically.

## 7. Rough plan once approved

1. Postgres provider + baseline migration + search provider (≈1 week).
2. OIDC `AuthProvider`, request `runAs`, team scoping, API-level redaction (≈1–2 weeks).
3. Containers, CI, staging environment, backups to object storage (≈1 week, depends on the platform team).
4. Pilot with one team, then migrate users via packs or snapshots.

## 8. Decisions needed

- Approval to host at all, and the data classification for user-entered deal data.
- Platform (Option A or B) and region.
- Identity provider and the group → role mapping.
- Who owns operations (patching, backups, on-call).
