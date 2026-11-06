import { practiceLabel } from "@/config/practice-areas";
import { detectTech } from "@/lib/adapters/classify";
import { tagText } from "@/lib/tagging/rules";
import type { ProposalInput } from "../../types";
import type { Posting } from "./boards";

/** Coarse function buckets for the hiring-trend chart (title first, department as fallback). */
export const FUNCTIONS: Array<[string, RegExp]> = [
  ["Data & AI", /\b(data|machine learning|ml|ai|analytics|scientist|llm)\b/i],
  ["Security", /\b(security|cyber|soc|iam|identity)\b/i],
  [
    "IT & infrastructure",
    /\b(infrastructure|it|network|systems|data cent(er|re)|sre|site reliability|cloud|platform|devops|helpdesk|service desk)\b/i,
  ],
  ["Engineering", /\b(engineer|developer|software|firmware|qa|architect)\b/i],
  ["Product & design", /\b(product|design|ux|ui)\b/i],
  [
    "Sales & marketing",
    /\b(sales|account|marketing|growth|business development|customer success)\b/i,
  ],
  [
    "Operations & G&A",
    /\b(operations|finance|legal|hr|people|recruit|accounting|procurement|supply)\b/i,
  ],
];
export const fnFor = (p: Posting) =>
  FUNCTIONS.find(([, re]) => re.test(p.title))?.[0] ??
  FUNCTIONS.find(([, re]) => re.test(p.department ?? ""))?.[0] ??
  "Other";

export function normalizeHiring(
  postings: Posting[],
  board: { provider: string; slug: string; url: string },
  now: Date,
): ProposalInput[] {
  const byFunction: Record<string, number> = {};
  for (const p of postings) byFunction[fnFor(p)] = (byFunction[fnFor(p)] ?? 0) + 1;
  const out: ProposalInput[] = [
    {
      field: "hiring.snapshot",
      value: {
        total: postings.length,
        byFunction,
        asOf: now.toISOString().slice(0, 10),
        provider: board.provider,
      },
      sourceUrl: board.url,
      confidence: "high",
      evidenceSnippet: `${postings.length} open roles on the public ${board.provider} board`,
    },
  ];
  // Initiative evidence: ≥ 3 open roles tagged to one practice area.
  const byPractice = new Map<string, Posting[]>();
  for (const p of postings)
    for (const t of tagText(`${p.title} ${p.department ?? ""}`).tags)
      byPractice.set(t, [...(byPractice.get(t) ?? []), p]);
  for (const [practice, list] of byPractice)
    if (list.length >= 3)
      out.push({
        field: `evidence.initiative:hiring-${practice}`,
        value: {
          title: `Hiring for ${practiceLabel(practice)}`,
          practiceAreas: [practice],
          section: "Public job board",
          description: `${list.length} open roles`,
          kind: "job-post",
        },
        sourceUrl: board.url,
        confidence: list.length >= 8 ? "high" : "medium",
        evidenceSnippet: `${list.length} open roles, e.g. ${list
          .slice(0, 3)
          .map((p) => `“${p.title}”`)
          .join(", ")}`,
        source: "Job board",
      });
  // Tech-stack hypotheses from posting titles/departments.
  const tech = new Map<
    string,
    { category: string; technology: string; n: number; example: string }
  >();
  for (const p of postings)
    for (const t of detectTech(`${p.title} ${p.department ?? ""}`)) {
      const k = `${t.category}:${t.technology}`;
      const prev = tech.get(k);
      tech.set(k, {
        category: t.category,
        technology: t.technology,
        n: (prev?.n ?? 0) + 1,
        example: prev?.example ?? p.title,
      });
    }
  for (const t of tech.values())
    out.push({
      field: `tech:${t.category}:${t.technology}`,
      value: { category: t.category, technology: t.technology, kind: "job-post" },
      sourceUrl: board.url,
      confidence: t.n >= 3 ? "medium" : "low",
      evidenceSnippet: `Hypothesis from ${t.n} job posting${t.n === 1 ? "" : "s"}, e.g. “${t.example}”`,
      source: "Job board",
    });
  return out;
}
