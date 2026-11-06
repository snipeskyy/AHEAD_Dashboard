# Adding an enricher (a new public source)

An enricher fills account fields from one public source. Adding one means **creating one folder**:
`src/lib/enrich/enrichers/<id>/index.ts`. `npm run gen:modules` (run automatically on dev, build and typecheck)
discovers it into `src/lib/enrich/enrichers/_generated.ts`.

## Rules (from CLAUDE.md)

- Public sources only: official APIs, public feeds, or the company's own website. Respect terms, rate limits and
  `robots.txt` (`ctx.http.page()` checks robots for you). No login-walled sites (LinkedIn, ZoomInfo, …).
- No personal contact details. Public executive names and titles from official filings are fine, as **suggestions**.
- Every value is a proposal with `sourceUrl` and `confidence`. Never invent values: if a source returns nothing,
  return no proposal and the field shows up under "Add what only you know".
- Keep parsing in a pure `normalize()` and test it with a recorded, **fictional** fixture. No live calls in tests.

## Step 0: vet the source (before writing code)

Answer these in the pull request description. If any answer is "no", don't build it and say why.

| Question                                                                 | Where to look                                             |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Is it an **official** API, public feed, or the company's own website?    | The provider's developer docs                             |
| Do the terms of use allow automated access for this purpose?             | Terms / API license                                       |
| Does `robots.txt` allow the paths you fetch (for web pages)?             | `https://host/robots.txt` (`ctx.http.page()` enforces it) |
| What are the rate limits, and is a key or contact User-Agent required?   | API docs. Keys go in `.env.local`, never in code          |
| Does it return personal contact details? Then drop those fields entirely | Response schema                                           |
| Is it login-walled or scraped from a ToS-restricted site? Then stop      | —                                                         |

## Worked example: an "Example Registry" enricher

`src/lib/enrich/enrichers/example-registry/normalize.ts` (pure):

```ts
import type { ProposalInput } from "../../types";

export interface RegistryRaw {
  company: { legal_name: string; employees?: number; founded?: number };
  url: string;
}

export function normalizeRegistry(raw: RegistryRaw): ProposalInput[] {
  const out: ProposalInput[] = [
    {
      field: "identity.legalName",
      value: raw.company.legal_name,
      sourceUrl: raw.url,
      confidence: "medium",
    },
  ];
  if (raw.company.employees)
    out.push({
      field: "firmographics.employeeCount",
      value: raw.company.employees,
      sourceUrl: raw.url,
      confidence: "medium",
      evidenceSnippet: "Example Registry filing",
    });
  return out;
}
```

`src/lib/enrich/enrichers/example-registry/index.ts`:

```ts
import type { Enricher } from "../../types";
import { normalizeRegistry, type RegistryRaw } from "./normalize";

const exampleRegistry: Enricher = {
  id: "example-registry",
  label: "Example Registry",
  source: "Example Registry", // shown on source chips
  description: "Legal name and headcount from the (fictional) Example Registry API.",
  requires: ["domain"], // identity keys that must be present (see AccountIdentity)
  produces: ["identity.legalName", "firmographics.employeeCount"],
  ttlDays: 90, // refresh interval; the worker re-runs it when stale
  defaultEnabled: false, // new sources start off until the user enables them
  optional: true, // labeled "Optional" in Settings → Data sources
  async run(id, ctx) {
    const raw = await ctx.http.json<RegistryRaw>(
      `https://api.registry.example/v1/companies?domain=${encodeURIComponent(id.domain!)}`,
      { ttlMs: 7 * 86_400_000 },
    );
    return { proposals: normalizeRegistry(raw) };
  },
};
export default exampleRegistry;
```

A test for the pure parser (`src/lib/enrich/enrichers/__tests__/enrichers.test.ts`):

```ts
import raw from "../__fixtures__/example-registry.json"; // fictional company, .example domain
import { normalizeRegistry } from "../example-registry/normalize";

it("example-registry: legal name and headcount, each with its source", () => {
  const p = normalizeRegistry(raw);
  expect(p.map((x) => x.field)).toEqual(["identity.legalName", "firmographics.employeeCount"]);
  expect(p.every((x) => x.sourceUrl.startsWith("https://"))).toBe(true);
  expect(normalizeRegistry({ ...raw, company: { legal_name: "Example Co" } })).toHaveLength(1); // nothing invented
});
```

Then:

1. Add a fixture under `src/lib/enrich/enrichers/__fixtures__/` (fictional company, `.example` domains) and a test
   in `src/lib/enrich/enrichers/__tests__/enrichers.test.ts` that calls `normalizeRegistry()` on it.
2. If it fills a new field, add it to `FIELD_DEFS` in `src/lib/enrich/fields.ts` (label, section, kind, tier weights,
   and `column` if it should mirror an Account column).
3. If the host needs a different politeness interval, add it to `HOST_GAP` in `src/lib/enrich/http.ts`.
4. To control run order (e.g. it needs a CIK another enricher finds), add its id to `ORDER` in
   `src/lib/enrich/registry.ts`.

## Check it live (once, by hand)

1. `npm run dev`, then Settings → Data sources → enable **Example Registry**.
2. On one real account, click **Fetch public data** in the Account 360 header.
3. Watch the worker log (`[enrich] example-registry …`), then review the values in **Proposed updates**: each one
   should show its source chip and link. Record "verified live (date)" in the CLAUDE.md decisions log.

## Troubleshooting

| Symptom                       | Likely cause                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The enricher never runs       | Not enabled in Settings → Data sources, or a `requires` identity key is missing (resolve identity first)                      |
| `429` / backoff in the log    | Add or raise `HOST_GAP` for the host; the run retries later on its own                                                        |
| Values apply without review   | They were `high` confidence into empty fields with `enrichment.autoApply` on: use `medium` unless the source is authoritative |
| A field never shows in the UI | It isn't in `FIELD_DEFS`                                                                                                      |
| Tests make network calls      | Only `normalize()` should be tested; `run()` stays thin                                                                       |

## What you get for free

- **HTTP**: `ctx.http.json/text/page` add the contact User-Agent, per-host rate limits, caching with TTL, retries with
  backoff on 429/5xx, timeouts, and robots.txt checks for `page()`.
- **Merge policy** (`src/lib/enrich/merge.ts`): high-confidence values fill empty fields; everything else waits for
  review; user-edited fields are locked; conflicts are shown side by side; history is kept per field.
- **List items**: proposals named `evidence.initiative:<key>`, `tech:<category>:<technology>` or `contact:<key>` are
  always reviewed and, when accepted, become Initiative, TechStackHypothesis or Contact records with their source.
- **Facts**: return `financials` (annual metrics) or `relations` (parent / subsidiary) to fill the Financial snapshot
  and Corporate hierarchy.
- **UI**: status, completeness, the queue, Proposed updates, source chips and Settings toggles all pick it up.
