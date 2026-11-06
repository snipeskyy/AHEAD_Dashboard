import type { Enricher } from "../../types";
import { normalizeAwards, type AwardRow } from "./normalize";

/** USAspending.gov (optional): federal contract awards received, by agency. For public-sector and contractor accounts. */
const usaspending: Enricher = {
  id: "usaspending",
  label: "USAspending federal awards",
  source: "USAspending.gov",
  description:
    "Optional. Federal contract awards to the organization over the last three years, with the top awarding agencies.",
  requires: [],
  produces: ["public.federalAwards"],
  ttlDays: 30,
  defaultEnabled: false,
  optional: true,
  async run(id, ctx) {
    const end = ctx.now.toISOString().slice(0, 10);
    const start = new Date(ctx.now.getTime() - 3 * 365 * 86_400_000).toISOString().slice(0, 10);
    const name = id.legalName ?? id.name;
    const body = JSON.stringify({
      filters: {
        recipient_search_text: [name],
        award_type_codes: ["A", "B", "C", "D"],
        time_period: [{ start_date: start, end_date: end }],
      },
      fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Start Date"],
      limit: 100,
      sort: "Award Amount",
      order: "desc",
    });
    const r = await ctx.http.json<{ results: AwardRow[] }>(
      "https://api.usaspending.gov/api/v2/search/spending_by_award/",
      { method: "POST", body, ttlMs: 7 * 86_400_000 },
    );
    return { proposals: normalizeAwards(r.results ?? [], name, start) };
  },
};
export default usaspending;
