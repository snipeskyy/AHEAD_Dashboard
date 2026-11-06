/** Suggested discovery questions for a meeting brief (pure, rules-based). Each says why it's suggested. */
export interface Question {
  q: string;
  why: string;
}

const BY_PRACTICE: Record<string, string> = {
  "ai-infra": "Where are you on moving AI pilots into production, and what's limiting GPU capacity today?",
  "modern-dc": "What's driving the data center plan: capacity, cost, or consolidation timing?",
  cloud: "Which workloads move next, and how are you keeping cloud spend predictable?",
  "data-analytics": "Which business decisions are slowed down by data access today?",
  security: "How has your resilience plan changed after recent incidents in your sector?",
  automation: "Where would automation free up the most engineering time this year?",
  esm: "Which service processes create the most friction for employees right now?",
  "managed-services": "Which operations would you rather not run in-house next year?",
  "integration-facility": "How long does it take today from hardware order to production, and what slows it down?",
};

const ROLE_Q: Record<string, string> = {
  EconomicBuyer: "Who owns the budget decision for this, and what do they need to see?",
  Champion: "Who on your side is most invested in this succeeding?",
  Technical: "Who will evaluate the architecture, and what are their criteria?",
};

export function suggestQuestions(input: {
  initiatives: Array<{ title: string; practiceAreas: string[] }>;
  missingRoles: string[];
  fiscalLabel: string | null;
  fiscalPhase: string | null;
  opps: Array<{ name: string; meddpiccScore: number; closeDate: string }>;
  execChange: { title: string } | null;
}): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const i of input.initiatives) {
    const p = i.practiceAreas.find((x) => BY_PRACTICE[x] && !seen.has(x));
    if (!p) continue;
    seen.add(p);
    out.push({ q: BY_PRACTICE[p], why: `Initiative evidence: ${i.title}` });
    if (seen.size >= 3) break;
  }
  if (input.fiscalLabel && input.fiscalPhase !== "closing")
    out.push({ q: "When does planning for next fiscal year start, and what's already on the list?", why: input.fiscalLabel });
  for (const r of input.missingRoles.slice(0, 2)) if (ROLE_Q[r]) out.push({ q: ROLE_Q[r], why: `No ${r.replace(/([A-Z])/g, " $1").trim()} identified yet` });
  const weak = input.opps.filter((o) => o.meddpiccScore < 60).sort((a, b) => a.closeDate.localeCompare(b.closeDate))[0];
  if (weak)
    out.push({ q: `What has to be true for “${weak.name}” to be approved by ${new Date(weak.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}?`, why: `MEDDPICC ${weak.meddpiccScore}% on an open deal` });
  if (input.execChange) out.push({ q: "What are the new leader's priorities for their first 90 days?", why: `Signal: ${input.execChange.title}` });
  if (!out.length) out.push({ q: "What are the top three priorities for your team this year?", why: "Not enough evidence yet for tailored questions" });
  return out.slice(0, 7);
}
