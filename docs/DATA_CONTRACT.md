# ACC Data Contract v1 (`acc-data`)

A neutral, versioned JSON file format for moving **your own account knowledge** into and out of ACC. Other tools
(for example a company AI assistant, once approved) can produce it, and ACC exports it. It carries no personal contact
details (no email, phone or address fields exist) and no pricing, rate cards or margins.

| File                                    | What it is                                                      |
| --------------------------------------- | --------------------------------------------------------------- |
| `docs/contract/acc-data-v1.schema.json` | JSON Schema (draft 2020-12): validate files before sending them |
| `docs/contract/example.acc-data.json`   | A fictional example with every entity type                      |
| `docs/contract/openapi.json`            | OpenAPI 3.1 description of the local read-only API              |

All three are generated from `src/lib/contract/*` by `npm run contract:schema`. A unit test fails if the committed
copies drift from the code.

## Shape

```json
{
  "format": "acc-data",
  "version": "1.0",
  "source": { "system": "internal-tool" },
  "visibility": "internal",
  "entities": {
    "accounts": [],
    "contacts": [],
    "opportunities": [],
    "activities": [],
    "notes": [],
    "tasks": [],
    "partnerReps": []
  }
}
```

- **`source.system`** scopes the `externalId`s. Re-importing a file from the same system matches records by
  `externalId` (stored in `ExternalRef`). Activities and tasks match on it directly. Accounts, contacts,
  opportunities, notes and partner reps also dedupe by natural key, the same way CSV imports do: accounts by domain,
  then legal name; contacts by account + name + title; opportunities by account + name.
- **Account references** (`account`, `partnerReps[].accounts[]`) are `{ externalId? , domain?, name? }`, with at least
  one of them. ACC resolves them in this order: an account in the same file, then an `externalId` it has seen before
  from this system, then domain, then exact legal name. Unknown accounts are row errors, never auto-created.
- **`sourceUrl`** (optional, any record) is the link where the sending system found the record, such as a CRM record or
  a document. ACC keeps it as provenance (`ExternalRef.sourceUrl`).
- **Dates** are ISO 8601 (`2026-11-30` or a full timestamp).
- **Enums** (tier, stage, seniority, buying role, engagement, channel) match ACC's own values; see the schema.
- **`visibility`**:
  - `internal` files may carry `accounts.ownerNotes`, `opportunities.amount` / `probability` and `notes`.
  - `customer-safe` files must not. ACC refuses a file labeled customer-safe that contains them.
- **ACC exports** set `source.system = "acc"`, `externalId = accId` = ACC's id. They also add `externalRefs`
  (`{ "<system>": "<id>" }`), so a sending system gets its own ids back.

## Import (file-based writes only)

Settings → **Data contract & API** → _Import a contract file…_

1. **Preview.** For each entity, the file is validated and every row is shown as new, merge, unchanged or error.
   Nothing is written yet.
2. **Import.** The same pipeline as CSV imports runs:
   - the server re-plans the file;
   - blank or missing values never erase existing data;
   - opportunities without an `amount` keep their current amount;
   - opportunities go through `updateOpportunity()` (stage history, rescoring).
3. **Undo.** The file becomes one ImportBatch per entity kind, all sharing a `groupId`. In Import → History, undoing
   any of them undoes the whole file: created rows are deleted, merged rows are restored, and their `ExternalRef`s are
   removed.

API equivalents: `POST /api/contract/preview` and `POST /api/contract/import` with `{ "file": <contract> }`. These are
same-origin only.

## Review queue and staging (Phase 15)

- Pasted text, uploaded files and `POST /api/v1/staged-imports` (token; off by default; separate switch) all go to
  **Waiting for review**.
- The review shows each new record and each changed field (current → incoming). **Apply** imports it; **Discard**
  clears it.
- **Data by source → Remove all data from <system>** undoes every import from that system. A backup is written first.

## Export

- `GET /api/contract/export?visibility=internal|customer-safe[&accounts=id,id]`, or the buttons in Settings.
- Demo accounts are never exported.
- The acting user's role hides the same fields as on screen:
  - `opp.amount` removes amounts;
  - `opp.forecast` removes probability;
  - `notes` removes notes and owner notes.

## Local read-only API (`/api/v1`)

Off by default. Turn it on and generate a token in Settings → Data contract & API. The token is shown once; only its
SHA-256 hash is stored, and the generic settings API never returns it.

```bash
curl -H "Authorization: Bearer $ACC_TOKEN" http://localhost:3000/api/v1/accounts
```

| Endpoint                                                          | Returns                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /api/v1`                                                     | Index (contract version, endpoints)                                        |
| `GET /api/v1/accounts`                                            | Accounts (paged)                                                           |
| `GET /api/v1/accounts/{id}`                                       | One account with contacts, opps, activities, notes, tasks and partner reps |
| `GET /api/v1/contacts`, `/opportunities`, `/activities`, `/tasks` | Paged lists (`?account=`, `?limit=` ≤ 5000, `?offset=`)                    |
| `GET /api/v1/export`                                              | The whole workspace as one contract file                                   |

- Every endpoint takes `?visibility=customer-safe` and applies the same role redaction as exports.
- The API is off → `403`. A missing or wrong token → `401`. Any method other than GET → `405`.
- No CORS headers are sent, so other web origins can't read responses from a browser.
- Turning the API on or off, and generating or revoking a token, are written to the audit log.

## Versioning

- `1.x` files stay readable by any ACC that reads v1: new optional fields only.
- A breaking change becomes `format: "acc-data"`, `version: "2.0"`, with a new schema file next to v1.
