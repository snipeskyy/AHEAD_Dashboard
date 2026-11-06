import {
  bestClaim,
  claimAmount,
  claimItem,
  claimString,
  claimYear,
  itemIds,
  wikidataPage,
  type Entity,
} from "../../wikidata";
import type { ProposalInput, RelationInput } from "../../types";

/** Wikidata entity (+ resolved labels) → proposals and relations. Values are medium/low: community-edited. */
export function normalizeEntity(
  e: Entity,
  labels: Map<string, string>,
  summary?: { extract?: string; url?: string } | null,
) {
  const src = wikidataPage(e.id);
  const out: ProposalInput[] = [
    { field: "identity.wikidataId", value: e.id, sourceUrl: src, confidence: "high" },
  ];
  const founded = claimYear(bestClaim(e, "P571"));
  if (founded)
    out.push({
      field: "firmographics.founded",
      value: founded,
      sourceUrl: src,
      confidence: "medium",
    });
  const emp = claimAmount(bestClaim(e, "P1128"));
  if (emp)
    out.push({
      field: "firmographics.employeeCount",
      value: Math.round(emp),
      sourceUrl: src,
      confidence: "medium",
      evidenceSnippet: "Wikidata P1128 (employees)",
    });
  const rev = claimAmount(bestClaim(e, "P2139"), true);
  if (rev)
    out.push({
      field: "firmographics.revenue",
      value: rev,
      sourceUrl: src,
      confidence: "low",
      evidenceSnippet: "Wikidata P2139 (revenue, USD)",
    });
  const ceo = claimItem(bestClaim(e, "P169"));
  if (ceo && labels.get(ceo))
    out.push({
      field: "firmographics.ceo",
      value: labels.get(ceo)!,
      sourceUrl: src,
      confidence: "medium",
    });
  const industries = itemIds(e, "P452", 3)
    .map((q) => labels.get(q))
    .filter(Boolean);
  if (industries.length)
    out.push({
      field: "firmographics.industry",
      value: industries[0]!.replace(/^./, (c) => c.toUpperCase()),
      sourceUrl: src,
      confidence: "low",
      evidenceSnippet: `Wikidata industry: ${industries.join(", ")}`,
    });
  const site = claimString(bestClaim(e, "P856"));
  if (site)
    out.push({ field: "firmographics.website", value: site, sourceUrl: src, confidence: "medium" });
  const lei = claimString(bestClaim(e, "P1278"));
  if (lei) out.push({ field: "identity.lei", value: lei, sourceUrl: src, confidence: "medium" });
  const cik = claimString(bestClaim(e, "P5531"));
  if (cik)
    out.push({
      field: "identity.cik",
      value: cik.padStart(10, "0"),
      sourceUrl: src,
      confidence: "medium",
    });
  if (summary?.extract && summary.extract.length > 40)
    out.push({
      field: "firmographics.description",
      value: summary.extract.slice(0, 800),
      sourceUrl: summary.url ?? src,
      confidence: "medium",
      evidenceSnippet: "Wikipedia summary",
      source: "Wikipedia",
    });

  const relations: RelationInput[] = [];
  const parent = claimItem(bestClaim(e, "P749"));
  if (parent && labels.get(parent))
    relations.push({
      relation: "direct-parent",
      name: labels.get(parent)!,
      wikidataId: parent,
      source: "Wikidata",
      sourceUrl: wikidataPage(parent),
    });
  for (const q of itemIds(e, "P355", 40))
    if (labels.get(q))
      relations.push({
        relation: "subsidiary",
        name: labels.get(q)!,
        wikidataId: q,
        source: "Wikidata",
        sourceUrl: wikidataPage(q),
      });
  return { proposals: out, relations };
}

/** Item ids whose labels the normalizer needs. */
export const labelIds = (e: Entity) =>
  [
    claimItem(bestClaim(e, "P169")),
    claimItem(bestClaim(e, "P749")),
    ...itemIds(e, "P452", 3),
    ...itemIds(e, "P355", 40),
  ].filter((x): x is string => !!x);
