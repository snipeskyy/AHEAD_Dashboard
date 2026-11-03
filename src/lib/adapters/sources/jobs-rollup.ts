import { practiceLabel } from "@/config/practice-areas";
import { tagText } from "@/lib/tagging/rules";
import { detectTech } from "../classify";
import type { AdapterAccount, DerivedEvidence, NormalizedSignal } from "../types";

export interface JobPosting {
  title: string;
  url: string | null;
  location: string | null;
  department: string | null;
  postedAt: Date | null;
}

const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y.getTime()) / 86_400_000 + 1) / 7)}`;
};

/**
 * Rolls public job postings up into at most one hiring signal per practice area per ISO week
 * (e.g. "Hiring 6 roles related to AI Infrastructure"), plus derived initiative / tech-stack evidence.
 * Only postings whose titles match practice keywords are considered relevant.
 */
export function rollupJobs(
  account: AdapterAccount,
  jobs: JobPosting[],
  source: string,
  boardUrl: string,
  now: Date,
): NormalizedSignal[] {
  const byPractice = new Map<string, JobPosting[]>();
  for (const j of jobs) {
    const text = `${j.title} ${j.department ?? ""}`;
    for (const p of tagText(text).tags) byPractice.set(p, [...(byPractice.get(p) ?? []), j]);
  }
  const week = isoWeek(now);
  const out: NormalizedSignal[] = [];
  for (const [practice, list] of byPractice) {
    const label = practiceLabel(practice);
    const examples = [...new Set(list.map((j) => j.title))].slice(0, 3);
    const evidence: DerivedEvidence[] = [];
    if (list.length >= 3) {
      evidence.push({
        kind: "initiative",
        title: `${label} build-out (hiring evidence)`,
        description: `${list.length} open roles related to ${label} on the public ${source === "greenhouse" ? "Greenhouse" : "Lever"} job board.`,
        practiceAreas: [practice],
        confidence: Math.min(0.85, 0.35 + list.length * 0.05),
      });
    }
    const techSeen = new Map<string, { category: string; technology: string; n: number }>();
    for (const j of list)
      for (const t of detectTech(j.title))
        techSeen.set(t.technology, { ...t, n: (techSeen.get(t.technology)?.n ?? 0) + 1 });
    for (const t of techSeen.values()) {
      evidence.push({
        kind: "tech",
        category: t.category,
        technology: t.technology,
        evidence: `${t.n} job title(s) mention it`,
        confidence: Math.min(0.8, 0.3 + t.n * 0.1),
      });
    }
    out.push({
      accountId: account.id,
      type: "hiring",
      title: `${account.name} hiring ${list.length} role${list.length > 1 ? "s" : ""} related to ${label}`,
      summary: `Public job postings include: ${examples.map((e) => `"${e}"`).join(", ")}${list.length > examples.length ? ` and ${list.length - examples.length} more` : ""}.`,
      url: list.find((j) => j.url)?.url ?? boardUrl,
      source,
      publishedAt:
        list.map((j) => j.postedAt ?? now).sort((a, b) => b.getTime() - a.getTime())[0] ?? now,
      tagText: list.map((j) => j.title).join(" | "),
      dedupeKey: `${source}:${practice}:${week}`,
      evidence,
    });
  }
  return out;
}
