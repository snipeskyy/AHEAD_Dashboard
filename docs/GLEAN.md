# Bringing Glean data into ACC

ACC is local: each person runs their own copy, and data stays on their computer. Glean produces an **acc-data** file
(the [data contract](DATA_CONTRACT.md)). ACC reviews it with you, then applies it. Nothing changes until you press
**Apply**, every import can be undone, and you can remove everything that came from Glean in one step.

## Before the first import (each user, once)

1. **Turn on FileVault** (System Settings → Privacy & Security → FileVault). The database is protected at rest by
   disk encryption.
2. Run `npm install && npm run setup`.
   - This creates an **ACC_BACKUP_KEY** in `.env.local`, so backups are AES-256-GCM encrypted. **Copy that key into
     your password manager**: without it, encrypted backups can't be restored.
   - Setup also locks file permissions and installs the commit guard, so data can't be committed to git.
3. Open **Settings → Data contract & API** and check that every item in the **Security checklist** is OK.
4. Use ACC only through `npm run dev` / `npm start`. They listen on `127.0.0.1`, so other machines can't reach it.

## Path A (use now): Glean agent → paste → review → apply

1. In Glean, create an agent (or a saved prompt) with the instructions below.
2. Run it for the accounts you need and copy its answer. Code fences and surrounding text are fine; ACC extracts the
   JSON.
3. In ACC, go to **Settings → Data contract & API → Bring in data → Paste Glean output → Review pasted data**.
4. Open each entity to check every new record and every changed field (current → incoming).
5. Then **Apply**, or **Discard** (nothing is kept).
6. Undo later from **Import → History**, or remove all Glean data under **Data by source**.

### Glean agent instructions (copy into Glean)

````
You produce data for Account Command Center (ACC) in its "acc-data" v1 JSON format. Output ONE JSON object in a
```json code block and nothing else.

Shape:
{
  "format": "acc-data",
  "version": "1.0",
  "source": { "system": "glean", "note": "<what you searched, e.g. 'Q4 pipeline for my accounts'>" },
  "visibility": "internal",
  "entities": {
    "accounts": [ { "externalId": "<CRM account id>", "sourceUrl": "<link to the CRM record or document>",
                    "name": "<legal name>", "domain": "<website domain>", "industry": "...", "hq": "<city, state>",
                    "tier": "Strategic|Growth|Maintain" } ],
    "contacts": [ { "externalId": "...", "sourceUrl": "...", "account": { "externalId": "<account id>" },
                    "displayName": "<name>", "title": "<job title>",
                    "seniority": "C-Level|VP|Director|Manager|IC",
                    "buyingRole": "EconomicBuyer|Champion|Technical|Influencer|Blocker" } ],
    "opportunities": [ { "externalId": "<CRM opportunity id>", "sourceUrl": "...", "account": { "externalId": "..." },
                    "name": "...", "practiceArea": "<one of: modern-dc, ai-infra, cloud, data-analytics, security,
                    automation, esm, managed-services, integration-facility>",
                    "stage": "Qualify|Discover|Solution|Proposal|Negotiate|ClosedWon|ClosedLost",
                    "amount": 0, "closeDate": "YYYY-MM-DD", "probability": 0, "nextStep": "...",
                    "nextStepDate": "YYYY-MM-DD" } ],
    "activities": [ { "externalId": "...", "account": { "externalId": "..." },
                    "channel": "email|linkedin|call|meeting|event|briefing", "persona": "<role met>",
                    "date": "YYYY-MM-DD", "completed": true, "summary": "<one line>" } ],
    "tasks": [ { "externalId": "...", "account": { "externalId": "..." }, "title": "...", "dueDate": "YYYY-MM-DD",
                 "priority": "high|normal|low", "status": "open|done" } ],
    "notes": [], "partnerReps": []
  }
}

Rules:
- Only include facts you found in a source; put that source's link in "sourceUrl". Never guess or invent values;
  leave a field out if you don't know it.
- Never include email addresses, phone numbers, home addresses, pricing, discounts, margins or contract terms.
- Use the CRM's ids as "externalId" so re-running updates records instead of duplicating them.
- Every contact, opportunity, activity and task must reference an account in this file (by externalId) or by
  "domain" / exact "name".
````

Adjust the practice-area ids to match **Settings → Taxonomy**. Opportunity `amount` and `probability` are internal:
customer-safe exports drop them automatically.

## Path B (built, switched off): Glean action → staging API → review

ACC can accept files from a Glean **action** at `POST /api/v1/staged-imports`. The OpenAPI description is in
`docs/contract/openapi.json`.

The endpoint only **stages** files. They appear under **Waiting for review**, and nothing is applied without a person.

It needs all of the following:

1. **Settings → Data contract & API:** _Enable the local API_ + _Let tools with the token send data for review_ +
   _Generate token_. The token is shown once; store it in Glean's action credential, never in a document.
2. **A network path from Glean to ACC.** ACC listens only on `127.0.0.1`, so Glean's cloud cannot reach a laptop.
   This path requires an approved, company-hosted deployment (`docs/TEAM_DEPLOYMENT.md`) and IT/security sign-off
   **before** anyone turns it on. Until then, use Path A.

Limits: 5 MB per file, 60 files an hour. A wrong or missing token gets 401; the API or staging switch being off gets 403. Turning the switches on or off and generating or revoking a token are written to the audit log.

## What protects the data

| Control                  | Where                                                                            |
| ------------------------ | -------------------------------------------------------------------------------- |
| Review before apply      | Waiting for review → field-level changes → Apply / Discard (payload cleared)     |
| Undo / remove a source   | Import → History (one file = one group); Data by source → Remove (backup first)  |
| Provenance               | Each record keeps Glean's `sourceUrl` and id (`ExternalRef`); shown in exports   |
| Encryption at rest       | FileVault (database) + AES-256-GCM backups (`ACC_BACKUP_KEY`)                    |
| Local only               | Binds to 127.0.0.1; same-origin check on every write (CSRF)                      |
| File permissions         | `backups/`, `exports/`, the database and `.env.local` readable only by you       |
| Nothing in git           | Commit guard blocks databases, backups, exports, contract files, keys, `.env*`   |
| No personal contact data | The contract has no email, phone or address fields                               |
| Customer-safe exports    | Internal fields (amounts, probability, notes) are removed for customer audiences |
