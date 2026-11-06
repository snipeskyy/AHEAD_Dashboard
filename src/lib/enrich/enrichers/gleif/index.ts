import { normalizeLegalName } from "@/lib/import/values";
import { getRecord, hierarchy, searchByName, summarize } from "../../gleif";
import type { Enricher } from "../../types";
import { normalizeLei } from "./normalize";

/** GLEIF: legal name, registered/HQ addresses, parent / ultimate parent / subsidiaries. */
const gleif: Enricher = {
  id: "gleif",
  label: "GLEIF legal entity & hierarchy",
  source: "GLEIF",
  description:
    "Legal Entity Identifier records: legal name, headquarters, direct and ultimate parent, and subsidiaries.",
  requires: [],
  produces: ["identity.lei", "identity.legalName", "firmographics.hqAddress", "relations"],
  ttlDays: 90,
  defaultEnabled: true,
  async run(id, ctx) {
    let record = id.lei ? await getRecord(ctx, id.lei).catch(() => null) : null;
    let matchedBy: "lei" | "exact-name" = "lei";
    if (!record) {
      // Without an LEI, only an unambiguous exact legal-name match is used; otherwise identity resolution decides.
      const target = normalizeLegalName(id.legalName ?? id.name);
      const hits = (await searchByName(ctx, id.legalName ?? id.name)).filter(
        (r) => normalizeLegalName(summarize(r).legalName) === target && summarize(r).active,
      );
      if (hits.length !== 1) {
        ctx.log(
          hits.length
            ? `${hits.length} GLEIF entities named "${id.name}" — resolve identity to choose`
            : "no exact GLEIF match",
        );
        return { proposals: [] };
      }
      record = hits[0];
      matchedBy = "exact-name";
    }
    return normalizeLei(record, await hierarchy(ctx, record.attributes.lei), matchedBy);
  },
};
export default gleif;
