import { normalizeLegalName } from "@/lib/import/values";
import type { Enricher } from "../../types";
import {
  getEntity,
  getLabels,
  label,
  looksLikeOrg,
  search,
  wikipediaSummary,
} from "../../wikidata";
import { labelIds, normalizeEntity } from "./normalize";

/** Wikidata + Wikipedia: founded, employees, revenue, CEO, industry, subsidiaries, short summary. */
const wikidata: Enricher = {
  id: "wikidata",
  label: "Wikidata & Wikipedia",
  source: "Wikidata",
  description:
    "Founded year, employee count, revenue, CEO, industry, parent and subsidiaries, plus the Wikipedia summary. Community-edited, so values are medium or low confidence.",
  requires: [],
  produces: ["identity.wikidataId", "firmographics.*", "relations"],
  ttlDays: 90,
  defaultEnabled: true,
  async run(id, ctx) {
    let q = id.wikidataId ?? null;
    if (!q) {
      // Only an unambiguous match on the exact name is used; otherwise identity resolution asks the user.
      const target = normalizeLegalName(id.legalName ?? id.name);
      const hits = (await search(ctx, id.legalName ?? id.name)).filter(
        (h) => normalizeLegalName(h.label) === target && looksLikeOrg(h),
      );
      if (hits.length !== 1) {
        ctx.log(
          hits.length
            ? "several Wikidata matches — resolve identity to choose"
            : "no confident Wikidata match",
        );
        return { proposals: [] };
      }
      q = hits[0].id;
    }
    const e = await getEntity(ctx, q);
    if (!e) return { proposals: [] };
    const labels = await getLabels(ctx, labelIds(e));
    const title = e.sitelinks?.enwiki?.title;
    const sum = title ? await wikipediaSummary(ctx, title).catch(() => null) : null;
    ctx.log(`using ${q} (${label(e)})`);
    return normalizeEntity(
      e,
      labels,
      sum ? { extract: sum.extract, url: sum.content_urls?.desktop?.page } : null,
    );
  },
};
export default wikidata;
