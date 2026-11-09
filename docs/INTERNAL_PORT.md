# Porting ACC to an internal company tool

This is a plan and boundary document. **Nothing in this repository connects to, or contains data from, any company
system.** A live connection needs the company's written approval (security, legal and data owners) and will be built
then, inside the company's environment, not in this public repository.

## What exists today (Phase 13)

| Piece                                | Where                                      | Status                                 |
| ------------------------------------ | ------------------------------------------ | -------------------------------------- |
| Neutral data contract (`acc-data`)   | `docs/DATA_CONTRACT.md`, `docs/contract/*` | Done; versioned, schema-validated      |
| File import with preview + undo      | Settings → Data contract & API             | Done                                   |
| Export (internal / customer-safe)    | Same page, `/api/contract/export`          | Done                                   |
| Local read-only API                  | `/api/v1/*`                                | Done; off by default, token-protected  |
| `private-future` adapter slot        | `src/lib/adapters/catalog.ts`              | **Throws `AdapterNotConfiguredError`** |
| CRM / marketing-automation connector | none                                       | Deliberately not built                 |

## Data classification

| Class                 | Examples                                                 | Where it may live                                                                    |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Public                | company profile, filings, press, job posts               | ACC, with `sourceUrl` provenance                                                     |
| User-entered          | your notes, hypotheses, tasks, your own pipeline entries | ACC (local DB), contract files you choose                                            |
| Company-internal      | CRM records, bookings, pricing, margins, contracts       | **Only inside the company's tools.** Never in this repo, its fixtures, docs or tests |
| Personal contact data | emails, phone numbers, home addresses                    | Nowhere in ACC: the contract has no fields for it                                    |

## How a port would work (once approved)

1. **Internal tool → ACC (file).** The internal tool writes an `acc-data` file with `source.system` set to its own
   name. The user imports it with a preview. Re-imports update records matched by `externalId`. One click undoes the
   whole file.
2. **ACC → internal tool (file or local API).** The internal tool reads `GET /api/v1/export` (token, read-only) or a
   downloaded contract file. Each record's `externalRefs` gives it back its own ids.
3. **AI assistant boundary.** An assistant may _read_ the contract (local API) to answer questions or draft
   deliverables. It never writes directly: changes arrive as a contract file the user previews and can undo. ACC's
   own `AiProvider` stays `nullAiProvider` (disabled) until an approved provider is configured.
4. **Field mapping.** Map the internal tool's fields onto the contract (accounts → `accounts`, opportunities →
   `opportunities`, and so on).
   - Internal-only fields map to the fields described "internal" in the schema, so customer-safe exports drop them
     automatically.
   - Pricing, margins and contract terms have no place in the contract. Leave them in the internal tool.

## What must not change without approval

- `private-future` keeps throwing; `crm-placeholder` keeps throwing.
- The repository stays neutral: no company names, logos, endpoints, credentials or sample internal data.
- The local API stays read-only, off by default and token-protected. Note that `next dev` / `next start` listen on
  all network interfaces by default, like the rest of the app, so keep the token private and revoke it when you
  are done. The hosted proposal in `docs/TEAM_DEPLOYMENT.md` is not deployed.

## Update (Phase 15, approved Nov 2026): Glean

- **Glean is the approved AI tool.** Each user runs ACC locally and brings in Glean output through the review queue
  (`docs/GLEAN.md`).
- **Internal data** may live in a user's local ACC: FileVault for the database, AES-256-GCM backups, and files only
  the user can read. It never goes in the repository; the commit guard enforces this.
- **The live path** (a Glean action calling `POST /api/v1/staged-imports`) is built but off. It also needs an
  approved hosted deployment, because a laptop bound to 127.0.0.1 isn't reachable from Glean.
