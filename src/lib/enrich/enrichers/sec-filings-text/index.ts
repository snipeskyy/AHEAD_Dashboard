import type { Enricher } from "../../types";
import { recentFilings, resolveCik, submissions } from "../../sec";
import { mineFiling } from "./normalize";

/** Latest 10-K text: rules-based initiative evidence from Items 1, 1A, 1C and 7 (snippets only). */
const secFilingsText: Enricher = {
  id: "sec-filings-text",
  label: "10-K initiative evidence",
  source: "SEC 10-K",
  description:
    "Reads the latest 10-K (Business, Risk Factors, Cybersecurity, MD&A) and cites short evidence for AI, data center, cloud, consolidation, cost, security, ERP and M&A initiatives.",
  requires: [],
  requiresAny: ["ticker", "cik"],
  produces: ["evidence.initiative:*"],
  ttlDays: 1,
  defaultEnabled: true,
  needsSecUserAgent: true,
  async run(id, ctx) {
    const cik = await resolveCik(ctx, id);
    if (!cik) return { proposals: [] };
    const tenK = recentFilings(await submissions(ctx, cik), ["10-K", "10-K/A", "20-F"])[0];
    if (!tenK) {
      ctx.log("no 10-K in recent filings");
      return { proposals: [] };
    }
    // Large document: read once, keep only snippets (not cached in HttpCache).
    const html = await ctx.http.text(tenK.url, { noStore: true, maxBytes: 15_000_000, ttlMs: 0 });
    return { proposals: mineFiling(html, { url: tenK.url, form: tenK.form, filed: tenK.filed }) };
  },
};
export default secFilingsText;
