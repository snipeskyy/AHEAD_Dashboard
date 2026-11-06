import type { Enricher } from "../../types";
import { recentFilings, resolveCik, submissions } from "../../sec";
import { officerProposals, parseOwnershipXml } from "./normalize";

/**
 * Named executive officers from recent SEC Form 3/4 filings (structured XML: name + officer title).
 * Offered as Buying Committee SUGGESTIONS the user accepts one by one. Name + title + source link only.
 */
const secOfficers: Enricher = {
  id: "sec-officers",
  label: "Executive officers (SEC filings)",
  source: "SEC insider filings",
  description:
    "Officer names and titles from recent Form 3/4 filings, suggested for the Buying Committee (never added automatically).",
  requires: [],
  requiresAny: ["ticker", "cik"],
  produces: ["contact:*", "firmographics.ceo"],
  ttlDays: 7,
  defaultEnabled: true,
  needsSecUserAgent: true,
  async run(id, ctx) {
    const cik = await resolveCik(ctx, id);
    if (!cik) return { proposals: [] };
    const filings = recentFilings(await submissions(ctx, cik), ["4", "3", "4/A"]).slice(0, 25);
    const found = [];
    for (const f of filings) {
      // primaryDocument points at the XSL-rendered view ("xslF345X06/form4.xml"); the raw XML sits beside it.
      const raw = f.indexUrl + f.primaryDocument.split("/").pop();
      try {
        const xml = await ctx.http.text(raw, { ttlMs: 30 * 86_400_000 });
        for (const o of parseOwnershipXml(xml))
          found.push({ ...o, url: f.indexUrl, filed: f.filed, form: f.form });
      } catch (e) {
        ctx.log(`skipped ${raw}: ${e instanceof Error ? e.message : e}`);
      }
    }
    return { proposals: officerProposals(found) };
  },
};
export default secOfficers;
