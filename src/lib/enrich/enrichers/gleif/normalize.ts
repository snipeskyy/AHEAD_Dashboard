import { gleifPage, summarize, type LeiRecord } from "../../gleif";
import type { ProposalInput, RelationInput } from "../../types";

export function normalizeLei(
  r: LeiRecord,
  h: { parent: LeiRecord | null; ultimate: LeiRecord | null; children: LeiRecord[] },
  matchedBy: "lei" | "exact-name",
): { proposals: ProposalInput[]; relations: RelationInput[] } {
  const s = summarize(r);
  const src = gleifPage(s.lei);
  const conf = matchedBy === "lei" ? "high" : "medium";
  const proposals: ProposalInput[] = [
    { field: "identity.lei", value: s.lei, sourceUrl: src, confidence: conf },
    {
      field: "identity.legalName",
      value: s.legalName,
      sourceUrl: src,
      confidence: conf,
      evidenceSnippet: "GLEIF legal name",
    },
  ];
  if (s.hq?.city)
    proposals.push({
      field: "firmographics.hqAddress",
      value: {
        lines: s.hq.addressLines ?? [],
        city: s.hq.city,
        region: s.hq.region ?? null,
        postalCode: s.hq.postalCode ?? null,
        country: s.hq.country ?? null,
      },
      sourceUrl: src,
      confidence: "medium",
      evidenceSnippet: "GLEIF headquarters address",
    });
  const rel = (x: LeiRecord, relation: RelationInput["relation"]): RelationInput => {
    const t = summarize(x);
    return {
      relation,
      name: t.legalName,
      lei: t.lei,
      country: t.country,
      source: "GLEIF",
      sourceUrl: gleifPage(t.lei),
    };
  };
  const relations: RelationInput[] = [];
  if (h.parent) relations.push(rel(h.parent, "direct-parent"));
  if (h.ultimate && h.ultimate.attributes.lei !== h.parent?.attributes.lei)
    relations.push(rel(h.ultimate, "ultimate-parent"));
  for (const c of h.children) relations.push(rel(c, "subsidiary"));
  return { proposals, relations };
}
