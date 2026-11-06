import type { Enricher } from "../../types";
import { pad10, resolveCik, submissions } from "../../sec";
import {
  FactsSchema,
  latestFinancialProposals,
  normalizeFacts,
  normalizeSubmissions,
} from "./normalize";

/** SEC EDGAR (public companies): identity, SIC industry, HQ, fiscal year end, 5-year revenue / net income / capex. */
const secEdgar: Enricher = {
  id: "sec-edgar",
  label: "SEC EDGAR profile & financials",
  source: "SEC EDGAR",
  description:
    "Official SEC submissions and XBRL company facts: CIK, SIC industry, addresses, fiscal year end, revenue, net income and capex trends.",
  requires: [],
  requiresAny: ["ticker", "cik"],
  produces: [
    "identity.*",
    "firmographics.sic",
    "firmographics.industry",
    "firmographics.hqAddress",
    "financials.*",
    "firmographics.revenue",
  ],
  ttlDays: 1,
  defaultEnabled: true,
  needsSecUserAgent: true,
  async run(id, ctx) {
    const cik = await resolveCik(ctx, id);
    if (!cik) {
      ctx.log(`no SEC registrant for ticker ${id.ticker}`);
      return { proposals: [] };
    }
    const s = await submissions(ctx, cik);
    const proposals = normalizeSubmissions(s);
    let financials: ReturnType<typeof normalizeFacts> = [];
    try {
      const facts = FactsSchema.parse(
        await ctx.http.json(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad10(cik)}.json`, {
          ttlMs: 86_400_000,
        }),
      );
      financials = normalizeFacts(facts, cik);
      proposals.push(...latestFinancialProposals(financials));
    } catch (e) {
      ctx.log(`no XBRL facts (${e instanceof Error ? e.message : e})`);
    }
    return { proposals, financials };
  },
};
export default secEdgar;
