/**
 * Next-best-actions: transparent rules over pipeline, engagement, signals and plans.
 * Pure function so it can be unit-tested; each action explains why it was suggested.
 */
export interface NbaInput {
  now: Date;
  opps: Array<{
    id: string;
    name: string;
    accountId: string;
    accountName: string;
    accountTier: string;
    stage: string;
    amount: number;
    closeDate: Date;
    daysInStage: number;
    meddpiccScore: number;
    riskFlags: string[];
  }>;
  accounts: Array<{
    id: string;
    name: string;
    tier: string;
    lastTouchAt: Date | null;
    nextTouchAt: Date | null;
    highSignals7d: number;
  }>;
  overduePlanActions: Array<{
    id: string;
    accountId: string;
    accountName: string;
    text: string;
    dueDate: Date;
  }>;
}

export interface NextAction {
  id: string;
  priority: number; // higher first
  kind: "deal" | "engage" | "plan" | "signal";
  title: string;
  why: string;
  href: string;
}

const DAY = 86_400_000;
const TIER_W: Record<string, number> = { Strategic: 1.5, Growth: 1.1, Maintain: 0.8 };

/** Amount weight: ~0 at $30k, ~1.5 at $1M, capped at 2. */
const amtW = (a: number) => Math.max(0, Math.min(2, Math.log10(Math.max(a, 10_000)) - 4.5));

export function nextBestActions(inp: NbaInput, max = 12): NextAction[] {
  const out: NextAction[] = [];

  for (const o of inp.opps) {
    const days = (o.closeDate.getTime() - inp.now.getTime()) / DAY;
    const tw = TIER_W[o.accountTier] ?? 1;
    if (
      o.riskFlags.includes("no-economic-buyer") &&
      ["Solution", "Proposal", "Negotiate"].includes(o.stage)
    ) {
      out.push({
        id: `eb-${o.id}`,
        priority: 80 * tw + amtW(o.amount) * 10,
        kind: "deal",
        title: `Identify the Economic Buyer on ${o.name}`,
        why: `${o.stage} stage with no Economic Buyer confirmed`,
        href: `/opportunities?focus=${o.id}`,
      });
    }
    if (days >= 0 && days <= 21 && o.meddpiccScore < 60) {
      out.push({
        id: `close-${o.id}`,
        priority: 75 * tw + amtW(o.amount) * 10,
        kind: "deal",
        title: `Firm up ${o.name} before close`,
        why: `Closes in ${Math.round(days)} days with MEDDPICC at ${o.meddpiccScore}%`,
        href: `/opportunities?focus=${o.id}`,
      });
    }
    if (o.riskFlags.includes("past-close-date")) {
      out.push({
        id: `past-${o.id}`,
        priority: 70 * tw + amtW(o.amount) * 8,
        kind: "deal",
        title: `Update the close date on ${o.name}`,
        why: `Close date passed ${Math.round(-days)} days ago`,
        href: `/opportunities?focus=${o.id}`,
      });
    } else if (o.riskFlags.includes("stalled") && o.accountTier !== "Maintain") {
      out.push({
        id: `stall-${o.id}`,
        priority: 60 * tw + amtW(o.amount) * 8,
        kind: "deal",
        title: `Re-engage on ${o.name}`,
        why: `No stage change in ${o.daysInStage} days`,
        href: `/opportunities?focus=${o.id}`,
      });
    }
  }

  for (const a of inp.accounts) {
    const tw = TIER_W[a.tier] ?? 1;
    const since = a.lastTouchAt ? (inp.now.getTime() - a.lastTouchAt.getTime()) / DAY : Infinity;
    const sinceText = Number.isFinite(since) ? `${Math.round(since)} days ago` : "never";
    if (a.highSignals7d >= 2 && since > 14) {
      out.push({
        id: `sig-${a.id}`,
        priority: 65 * tw + a.highSignals7d,
        kind: "signal",
        title: `Reach out to ${a.name}`,
        why: `${a.highSignals7d} high-relevance signals this week; last touch ${sinceText}`,
        href: `/accounts/${a.id}?tab=signals`,
      });
    } else if (a.tier === "Strategic" && since > 30 && !a.nextTouchAt) {
      out.push({
        id: `cold-${a.id}`,
        priority: 55 * tw,
        kind: "engage",
        title: `Plan a touch for ${a.name}`,
        why: `Strategic account, last touch ${sinceText}, nothing scheduled`,
        href: `/accounts/${a.id}`,
      });
    }
  }

  for (const p of inp.overduePlanActions) {
    const late = Math.round((inp.now.getTime() - p.dueDate.getTime()) / DAY);
    out.push({
      id: `plan-${p.id}`,
      priority: 50 + Math.min(late, 30) / 3,
      kind: "plan",
      title: p.text,
      why: `Account plan action for ${p.accountName}, ${late} day${late === 1 ? "" : "s"} overdue`,
      href: `/accounts/${p.accountId}?tab=plan`,
    });
  }

  return diversify(
    out.sort((a, b) => b.priority - a.priority),
    max,
  );
}

/**
 * Keeps the list varied: round-robin across action types (EB gap, close risk, stalled, signals,
 * cold strategic, overdue plan), each type in its own priority order.
 */
export function diversify(sorted: NextAction[], max: number): NextAction[] {
  const typeOf = (a: NextAction) => a.id.split("-")[0];
  const queues = new Map<string, NextAction[]>();
  for (const a of sorted) queues.set(typeOf(a), [...(queues.get(typeOf(a)) ?? []), a]);
  // Visit types in order of their best item's priority.
  const types = [...queues.keys()];
  const out: NextAction[] = [];
  while (out.length < max && types.some((t) => queues.get(t)!.length)) {
    for (const t of types) {
      const next = queues.get(t)!.shift();
      if (next) out.push(next);
      if (out.length >= max) break;
    }
  }
  return out;
}
