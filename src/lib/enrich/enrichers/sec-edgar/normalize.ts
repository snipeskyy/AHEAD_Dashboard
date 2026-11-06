import { z } from "zod";
import { companyPage, recentFilings, type Submissions } from "../../sec";
import type { FinancialInput, ProposalInput } from "../../types";

const title = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** SEC submissions → identity, industry, HQ, fiscal year end, IR links. */
export function normalizeSubmissions(s: Submissions): ProposalInput[] {
  const src = companyPage(String(s.cik));
  const out: ProposalInput[] = [
    {
      field: "identity.cik",
      value: String(s.cik).padStart(10, "0"),
      sourceUrl: src,
      confidence: "high",
    },
    {
      field: "identity.legalName",
      value: s.name,
      sourceUrl: src,
      confidence: "high",
      evidenceSnippet: "SEC registrant name",
    },
  ];
  if (s.tickers[0])
    out.push({
      field: "identity.ticker",
      value: s.tickers[0].toUpperCase(),
      sourceUrl: src,
      confidence: "high",
      evidenceSnippet: s.exchanges[0] ? `Listed on ${s.exchanges[0]}` : undefined,
    });
  if (s.lei) out.push({ field: "identity.lei", value: s.lei, sourceUrl: src, confidence: "high" });
  if (s.sic) {
    out.push({
      field: "firmographics.sic",
      value: `${s.sic}${s.sicDescription ? ` · ${s.sicDescription}` : ""}`,
      sourceUrl: src,
      confidence: "high",
    });
    if (s.sicDescription)
      out.push({
        field: "firmographics.industry",
        value: title(s.sicDescription),
        sourceUrl: src,
        confidence: "medium",
        evidenceSnippet: `SEC SIC code ${s.sic}`,
      });
  }
  if (s.fiscalYearEnd && /^\d{4}$/.test(s.fiscalYearEnd))
    out.push({
      field: "financials.fiscalYearEnd",
      value: s.fiscalYearEnd,
      sourceUrl: src,
      confidence: "high",
      evidenceSnippet: "SEC filer profile",
    });
  const b = s.addresses.business;
  if (b?.city)
    out.push({
      field: "firmographics.hqAddress",
      value: {
        lines: [b.street1, b.street2].filter(Boolean),
        city: title(b.city),
        region: b.stateOrCountry ?? null,
        postalCode: b.zipCode ?? null,
        country:
          b.stateOrCountryDescription && b.stateOrCountryDescription.length > 2
            ? b.stateOrCountryDescription
            : "US",
      },
      sourceUrl: src,
      confidence: "high",
      evidenceSnippet: "SEC business address",
    });
  if (s.website)
    out.push({
      field: "firmographics.website",
      value: s.website,
      sourceUrl: src,
      confidence: "medium",
    });
  if (s.investorWebsite)
    out.push({
      field: "web.investorUrl",
      value: s.investorWebsite,
      sourceUrl: src,
      confidence: "medium",
    });
  return out;
}

const Fact = z.object({
  start: z.string().optional(),
  end: z.string(),
  val: z.number(),
  accn: z.string(),
  form: z.string(),
  filed: z.string(),
});
export const FactsSchema = z.object({
  cik: z.union([z.number(), z.string()]),
  facts: z.object({
    "us-gaap": z
      .record(z.string(), z.object({ units: z.record(z.string(), z.array(Fact)) }))
      .optional(),
  }),
});
export type Facts = z.infer<typeof FactsSchema>;

const CONCEPTS: Record<FinancialInput["metric"], string[]> = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
  ],
  netIncome: ["NetIncomeLoss"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
};
const DAY = 86_400_000;

/**
 * Annual values from 10-K filings: full-year durations (≈ 1 year), latest filing per period end,
 * newest five years. Concepts are tried in order; the first with data wins per period.
 */
export function normalizeFacts(f: Facts, cik: string): FinancialInput[] {
  const gaap = f.facts["us-gaap"] ?? {};
  const out: FinancialInput[] = [];
  for (const [metric, names] of Object.entries(CONCEPTS) as Array<
    [FinancialInput["metric"], string[]]
  >) {
    const byEnd = new Map<string, z.infer<typeof Fact>>();
    for (const n of names) {
      for (const x of gaap[n]?.units.USD ?? []) {
        if (!/^10-K/.test(x.form) || !x.start) continue;
        const days = (Date.parse(x.end) - Date.parse(x.start)) / DAY;
        if (days < 330 || days > 400) continue;
        const prev = byEnd.get(x.end);
        if (!prev || x.filed > prev.filed) byEnd.set(x.end, x);
      }
      if (byEnd.size) break;
    }
    const rows = [...byEnd.values()].sort((a, b) => b.end.localeCompare(a.end)).slice(0, 5);
    for (const x of rows)
      out.push({
        metric,
        fiscalYear: new Date(x.end).getUTCFullYear(),
        periodEnd: new Date(`${x.end}T00:00:00Z`),
        value: x.val,
        unit: "USD",
        sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${x.accn.replace(/-/g, "")}/`,
      });
  }
  return out;
}

/** Latest-year values as proposals (revenue / capex / net income). */
export function latestFinancialProposals(rows: FinancialInput[]): ProposalInput[] {
  const field = {
    revenue: "firmographics.revenue",
    capex: "financials.capex",
    netIncome: "financials.netIncome",
  } as const;
  return (Object.keys(field) as Array<keyof typeof field>).flatMap((m) => {
    const r = rows.filter((x) => x.metric === m).sort((a, b) => +b.periodEnd - +a.periodEnd)[0];
    return r
      ? [
          {
            field: field[m],
            value: r.value,
            sourceUrl: r.sourceUrl,
            confidence: "high" as const,
            evidenceSnippet: `10-K, fiscal year ended ${r.periodEnd.toISOString().slice(0, 10)}`,
          },
        ]
      : [];
  });
}

export { recentFilings };
