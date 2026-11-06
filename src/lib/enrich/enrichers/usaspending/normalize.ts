import { normalizeLegalName } from "@/lib/import/values";
import type { ProposalInput } from "../../types";

export interface AwardRow {
  "Award ID": string;
  "Recipient Name": string;
  "Award Amount": number | null;
  "Awarding Agency": string | null;
  "Start Date"?: string | null;
}

/** Federal contract awards whose recipient name matches the account (normalized legal name). */
export function normalizeAwards(rows: AwardRow[], name: string, since: string): ProposalInput[] {
  const t = normalizeLegalName(name);
  const mine = rows.filter((r) => normalizeLegalName(r["Recipient Name"]) === t);
  if (!mine.length) return [];
  const total = mine.reduce((s, r) => s + (r["Award Amount"] ?? 0), 0);
  const byAgency = new Map<string, number>();
  for (const r of mine)
    if (r["Awarding Agency"])
      byAgency.set(
        r["Awarding Agency"],
        (byAgency.get(r["Awarding Agency"]) ?? 0) + (r["Award Amount"] ?? 0),
      );
  const top = [...byAgency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([agency, amount]) => ({ agency, amount }));
  return [
    {
      field: "public.federalAwards",
      value: { awards: mine.length, totalValue: total, topAgencies: top, activitySince: since },
      sourceUrl: `https://www.usaspending.gov/keyword_search/${encodeURIComponent(name)}`,
      confidence: "medium",
      evidenceSnippet: `${mine.length} federal contract award${mine.length === 1 ? "" : "s"} with activity since ${since} (largest shown; values are total award amounts)`,
    },
  ];
}
