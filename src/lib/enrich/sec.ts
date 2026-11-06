/**
 * Shared SEC EDGAR access (official JSON APIs; SEC fair-access policy: contact User-Agent, ≤ 10 req/s).
 * Pure parsers are exported for tests; fetchers take the enricher context's http.
 */
import { z } from "zod";
import type { EnrichContext } from "./types";

const DAY = 86_400_000;
export const pad10 = (cik: string | number) => String(cik).replace(/\D/g, "").padStart(10, "0");
export const cikNum = (cik: string | number) => String(Number(String(cik).replace(/\D/g, "")));
export const companyPage = (cik: string) =>
  `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${pad10(cik)}`;
export const archiveDir = (cik: string, accession: string) =>
  `https://www.sec.gov/Archives/edgar/data/${cikNum(cik)}/${accession.replace(/-/g, "")}/`;

const TickerMap = z.record(
  z.string(),
  z.object({ cik_str: z.number(), ticker: z.string(), title: z.string() }),
);
export type TickerRow = { cik: string; ticker: string; title: string };

export function parseTickerMap(raw: unknown): TickerRow[] {
  return Object.values(TickerMap.parse(raw)).map((r) => ({
    cik: pad10(r.cik_str),
    ticker: r.ticker.toUpperCase(),
    title: r.title,
  }));
}

export async function tickerTable(ctx: Pick<EnrichContext, "http">) {
  return parseTickerMap(
    await ctx.http.json("https://www.sec.gov/files/company_tickers.json", { ttlMs: 7 * DAY }),
  );
}

const Address = z
  .object({
    street1: z.string().nullish(),
    street2: z.string().nullish(),
    city: z.string().nullish(),
    stateOrCountry: z.string().nullish(),
    stateOrCountryDescription: z.string().nullish(),
    zipCode: z.string().nullish(),
  })
  .partial();

export const SubmissionsSchema = z.object({
  cik: z.union([z.string(), z.number()]),
  name: z.string(),
  sic: z.string().nullish(),
  sicDescription: z.string().nullish(),
  tickers: z.array(z.string()).default([]),
  exchanges: z.array(z.string().nullable()).default([]),
  fiscalYearEnd: z.string().nullish(),
  website: z.string().nullish(),
  investorWebsite: z.string().nullish(),
  lei: z.string().nullish(),
  stateOfIncorporation: z.string().nullish(),
  addresses: z
    .object({ business: Address.nullish(), mailing: Address.nullish() })
    .partial()
    .default({}),
  filings: z.object({
    recent: z.object({
      accessionNumber: z.array(z.string()),
      filingDate: z.array(z.string()),
      form: z.array(z.string()),
      primaryDocument: z.array(z.string()),
      items: z.array(z.string()).optional(),
      reportDate: z.array(z.string()).optional(),
    }),
  }),
});
export type Submissions = z.infer<typeof SubmissionsSchema>;

export async function submissions(ctx: Pick<EnrichContext, "http">, cik: string) {
  return SubmissionsSchema.parse(
    await ctx.http.json(`https://data.sec.gov/submissions/CIK${pad10(cik)}.json`, { ttlMs: DAY }),
  );
}

export interface FilingRef {
  form: string;
  filed: string;
  accession: string;
  primaryDocument: string;
  items: string;
  url: string;
  indexUrl: string;
}

export function recentFilings(s: Submissions, forms?: string[]): FilingRef[] {
  const r = s.filings.recent;
  const cik = String(s.cik);
  return r.accessionNumber
    .map((acc, i) => ({
      form: r.form[i],
      filed: r.filingDate[i],
      accession: acc,
      primaryDocument: r.primaryDocument[i],
      items: r.items?.[i] ?? "",
      url: archiveDir(cik, acc) + r.primaryDocument[i],
      indexUrl: archiveDir(cik, acc),
    }))
    .filter((f) => !forms || forms.includes(f.form));
}

/** Resolve a CIK from the identity (CIK wins; else exact ticker match). */
export async function resolveCik(
  ctx: Pick<EnrichContext, "http">,
  id: { cik?: string | null; ticker?: string | null },
) {
  if (id.cik) return pad10(id.cik);
  if (!id.ticker) return null;
  const t = id.ticker.toUpperCase().replace(".", "-");
  return (
    (await tickerTable(ctx)).find((r) => r.ticker === t || r.ticker === id.ticker!.toUpperCase())
      ?.cik ?? null
  );
}
