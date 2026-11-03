import { practiceLabel } from "@/config/practice-areas";

/**
 * Pain points and opening angles are DERIVED from evidence (initiatives + signals); nothing is invented.
 * Each output carries the evidence it came from so the UI can link to the public source.
 */
export const PRACTICE_PAINS: Record<string, string[]> = {
  "ai-infra": [
    "GPU capacity and lead times limit AI roadmap",
    "Power and cooling constraints for accelerated compute",
    "Moving AI pilots into production reliably",
  ],
  "modern-dc": [
    "Aging infrastructure and refresh backlog",
    "Facility footprint and lease costs",
    "Rack density exceeding air-cooling limits",
  ],
  cloud: [
    "Cloud spend growing faster than value",
    "Inconsistent landing zones and guardrails",
    "Workload placement decisions across clouds",
  ],
  "data-analytics": [
    "Fragmented data platforms slow analytics and AI",
    "Governance gaps for sensitive data",
    "Data engineering capacity",
  ],
  security: [
    "Ransomware recovery readiness",
    "Identity sprawl and zero-trust gaps",
    "Regulatory incident-reporting requirements",
  ],
  automation: [
    "Slow environment provisioning for product teams",
    "Manual toil in infrastructure operations",
    "Inconsistent CI/CD and IaC practices",
  ],
  esm: [
    "Service management limited to IT",
    "Instance health and technical debt",
    "Manual, email-driven workflows",
  ],
  "managed-services": [
    "Scarce infrastructure talent",
    "24x7 operational coverage",
    "Day-2 operations distracting from transformation",
  ],
  "integration-facility": [
    "Weeks-long rack deployment cycles",
    "On-site integration risk and DOA parts",
    "Supply-chain unpredictability",
  ],
};

export interface Evidence {
  kind: "initiative" | "signal" | "tech";
  id: string;
  title: string;
  url: string | null;
  source: string;
  date?: string | null;
}

export interface PainPoint {
  practiceArea: string;
  pain: string;
  evidence: Evidence[];
}

export interface OpeningAngle {
  practiceArea: string;
  angle: string;
  evidence: Evidence;
}

export interface AngleInputs {
  initiatives: Array<{
    id: string;
    title: string;
    practiceAreas: string[];
    source: string;
    sourceUrl: string | null;
    confidence: number;
  }>;
  signals: Array<{
    id: string;
    title: string;
    type: string;
    practiceTags: string[];
    url: string | null;
    source: string;
    publishedAt: string;
    relevance: number;
  }>;
  practiceStatus: Record<string, string>;
}

/** Map evidence → practice areas → likely pains. Pains with no evidence are omitted. */
export function derivePainPoints(inp: AngleInputs, maxPerPractice = 1): PainPoint[] {
  const byPractice = new Map<string, Evidence[]>();
  const push = (p: string, e: Evidence) => byPractice.set(p, [...(byPractice.get(p) ?? []), e]);
  for (const i of inp.initiatives)
    for (const p of i.practiceAreas)
      push(p, { kind: "initiative", id: i.id, title: i.title, url: i.sourceUrl, source: i.source });
  for (const s of inp.signals.slice(0, 40))
    for (const p of s.practiceTags)
      push(p, {
        kind: "signal",
        id: s.id,
        title: s.title,
        url: s.url,
        source: s.source,
        date: s.publishedAt,
      });
  const out: PainPoint[] = [];
  for (const [p, ev] of [...byPractice.entries()].sort((a, b) => b[1].length - a[1].length)) {
    for (const pain of (PRACTICE_PAINS[p] ?? []).slice(0, maxPerPractice))
      out.push({ practiceArea: p, pain, evidence: ev.slice(0, 3) });
  }
  return out;
}

const ANGLE_TEMPLATES: Record<string, (title: string, practice: string) => string> = {
  hiring: (_t, p) =>
    `Your team is hiring for ${p} — how are you thinking about scaling that capability without adding headcount risk?`,
  "exec-change": () =>
    `Congratulations on the leadership change — what's on the first-90-day agenda?`,
  incident: (_t, p) =>
    `Following the recent disruption, how is the team approaching ${p} resilience?`,
  earnings: (_t, p) =>
    `Leadership called out ${p} priorities on the earnings call — where are you in planning?`,
  filing: (_t, p) =>
    `Your recent filing touches on ${p} — how is that translating into the IT roadmap?`,
  "m-and-a": () =>
    `With the acquisition, how are you approaching Day-1 and Day-100 infrastructure integration?`,
  expansion: (_t, p) =>
    `The expansion likely brings new ${p} requirements — who is shaping the design?`,
  default: (t, p) => `Saw "${t}" — how is that shaping your ${p} plans?`,
};

/** Conversation starters, each tied to one piece of evidence; prefers un-engaged practices and recent, relevant signals. */
export function deriveOpeningAngles(inp: AngleInputs, max = 6): OpeningAngle[] {
  const out: OpeningAngle[] = [];
  const seen = new Set<string>();
  const signals = [...inp.signals].sort((a, b) => {
    const ea =
      inp.practiceStatus[a.practiceTags[0]] === "NotEngaged" ||
      inp.practiceStatus[a.practiceTags[0]] === "Exploring"
        ? 1
        : 0;
    const eb =
      inp.practiceStatus[b.practiceTags[0]] === "NotEngaged" ||
      inp.practiceStatus[b.practiceTags[0]] === "Exploring"
        ? 1
        : 0;
    return eb - ea || b.relevance - a.relevance;
  });
  for (const s of signals) {
    const p = s.practiceTags[0];
    if (!p || seen.has(p)) continue;
    seen.add(p);
    const tpl = ANGLE_TEMPLATES[s.type] ?? ANGLE_TEMPLATES.default;
    out.push({
      practiceArea: p,
      angle: tpl(s.title, practiceLabel(p)),
      evidence: {
        kind: "signal",
        id: s.id,
        title: s.title,
        url: s.url,
        source: s.source,
        date: s.publishedAt,
      },
    });
    if (out.length >= max) return out;
  }
  for (const i of inp.initiatives) {
    const p = i.practiceAreas[0];
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push({
      practiceArea: p,
      angle: `You're pursuing "${i.title}" — what would make the next phase a clear success?`,
      evidence: {
        kind: "initiative",
        id: i.id,
        title: i.title,
        url: i.sourceUrl,
        source: i.source,
      },
    });
    if (out.length >= max) break;
  }
  return out;
}
