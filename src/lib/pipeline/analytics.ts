import { OPEN_STAGES, STAGES } from "@/lib/domain/enums";
import type { PipelineOpp, StageEvent } from "./types";

const DAY = 86_400_000;
const isOpen = (s: string) => (OPEN_STAGES as readonly string[]).includes(s);

export function quarterOf(d: Date) {
  return { year: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) + 1 };
}
export const quarterKey = (d: Date) => {
  const { year, q } = quarterOf(d);
  return `${year}-Q${q}`;
};
export const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function quarterBounds(now: Date) {
  const { year, q } = quarterOf(now);
  const start = new Date(Date.UTC(year, (q - 1) * 3, 1));
  const end = new Date(Date.UTC(year, q * 3, 1));
  return { start, end };
}

export interface Kpis {
  pipelineTotal: number;
  weightedPipeline: number;
  activeOpps: number;
  winRate: number | null; // last 12 months, by count
  avgCycleDays: number | null; // won deals, last 12 months
  wonThisQuarter: number;
  pipelineThisQuarter: number;
  quarterlyTarget: number;
  coverageRatio: number | null; // pipeline closing this quarter ÷ remaining target
  coverageTarget: number;
  /** False until the user sets a quarterly target in Settings (targets start blank). */
  targetSet: boolean;
}

export function computeKpis(
  opps: PipelineOpp[],
  now: Date,
  quarterlyTarget: number,
  coverageTarget: number,
): Kpis {
  const open = opps.filter((o) => isOpen(o.stage));
  const yearAgo = new Date(now.getTime() - 365 * DAY);
  const closed12 = opps.filter((o) => o.closedAt && o.closedAt >= yearAgo);
  const won12 = closed12.filter((o) => o.stage === "ClosedWon");
  const { start, end } = quarterBounds(now);
  const wonQ = opps
    .filter((o) => o.stage === "ClosedWon" && o.closedAt && o.closedAt >= start && o.closedAt < end)
    .reduce((s, o) => s + o.amount, 0);
  const pipeQ = open
    .filter((o) => o.closeDate >= start && o.closeDate < end)
    .reduce((s, o) => s + o.amount, 0);
  const remaining = Math.max(0, quarterlyTarget - wonQ);
  return {
    pipelineTotal: open.reduce((s, o) => s + o.amount, 0),
    weightedPipeline: open.reduce((s, o) => s + (o.amount * o.probability) / 100, 0),
    activeOpps: open.length,
    winRate: closed12.length ? won12.length / closed12.length : null,
    avgCycleDays: won12.length
      ? won12.reduce((s, o) => s + (o.closedAt!.getTime() - o.createdAt.getTime()) / DAY, 0) /
        won12.length
      : null,
    wonThisQuarter: wonQ,
    pipelineThisQuarter: pipeQ,
    quarterlyTarget,
    coverageRatio: quarterlyTarget > 0 && remaining > 0 ? pipeQ / remaining : null,
    coverageTarget,
    targetSet: quarterlyTarget > 0,
  };
}

/** Tone for the coverage tile; undefined (neutral) until both targets are set. */
export function coverageTone(k: Kpis): "good" | "warning" | "critical" | undefined {
  if (!k.targetSet) return undefined;
  if (k.coverageRatio === null) return "good";
  if (!k.coverageTarget) return undefined;
  if (k.coverageRatio >= k.coverageTarget) return "good";
  return k.coverageRatio >= k.coverageTarget * 0.75 ? "warning" : "critical";
}

export interface ForecastBucket {
  key: string;
  commit: number;
  bestCase: number; // commit + best case
  pipeline: number; // all open
  weighted: number;
  closedWon: number;
}

/**
 * Forecast by period. Open deals bucket by close date; won deals by closedAt.
 * bestCase is cumulative (Commit + BestCase), the usual roll-up convention.
 */
export function computeForecast(
  opps: PipelineOpp[],
  grain: "month" | "quarter",
  periods: string[],
): ForecastBucket[] {
  const keyOf = grain === "month" ? monthKey : quarterKey;
  const map = new Map(
    periods.map((k) => [
      k,
      { key: k, commit: 0, bestCase: 0, pipeline: 0, weighted: 0, closedWon: 0 },
    ]),
  );
  for (const o of opps) {
    if (o.stage === "ClosedWon" && o.closedAt) {
      const b = map.get(keyOf(o.closedAt));
      if (b) b.closedWon += o.amount;
      continue;
    }
    if (!isOpen(o.stage) || o.forecastCategory === "Omitted") continue;
    const b = map.get(keyOf(o.closeDate));
    if (!b) continue;
    b.pipeline += o.amount;
    b.weighted += (o.amount * o.probability) / 100;
    if (o.forecastCategory === "Commit") b.commit += o.amount;
    if (o.forecastCategory === "Commit" || o.forecastCategory === "BestCase")
      b.bestCase += o.amount;
  }
  return periods.map((k) => map.get(k)!);
}

export function nextPeriods(
  now: Date,
  grain: "month" | "quarter",
  count: number,
  offset = 0,
): string[] {
  const out: string[] = [];
  for (let i = offset; i < offset + count; i++) {
    const d =
      grain === "month"
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1))
        : new Date(
            Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3 + i * 3, 1),
          );
    out.push(grain === "month" ? monthKey(d) : quarterKey(d));
  }
  return out;
}

export interface StageConversion {
  stage: string;
  reached: number;
  advanced: number;
  rate: number | null;
}

/** Of deals that reached each stage, what share moved to a later stage (incl. ClosedWon)? */
export function stageConversion(events: StageEvent[]): StageConversion[] {
  const order = [...OPEN_STAGES, "ClosedWon"];
  const reached = new Map<string, Set<string>>();
  const maxIdx = new Map<string, number>();
  for (const e of events) {
    const idx = order.indexOf(e.toStage);
    if (idx < 0) continue;
    if (!reached.has(e.toStage)) reached.set(e.toStage, new Set());
    reached.get(e.toStage)!.add(e.opportunityId);
    maxIdx.set(e.opportunityId, Math.max(maxIdx.get(e.opportunityId) ?? -1, idx));
  }
  return OPEN_STAGES.map((stage, i) => {
    const ids = reached.get(stage) ?? new Set<string>();
    const advanced = [...ids].filter((id) => (maxIdx.get(id) ?? -1) > i).length;
    return { stage, reached: ids.size, advanced, rate: ids.size ? advanced / ids.size : null };
  });
}

/** Average days spent in each open stage (from consecutive stage events). */
export function stageVelocity(
  events: StageEvent[],
  now: Date,
): Array<{ stage: string; avgDays: number | null; samples: number }> {
  const byOpp = new Map<string, StageEvent[]>();
  for (const e of events) byOpp.set(e.opportunityId, [...(byOpp.get(e.opportunityId) ?? []), e]);
  const acc = new Map<string, { total: number; n: number }>();
  for (const evs of byOpp.values()) {
    evs.sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
    evs.forEach((e, i) => {
      if (!isOpen(e.toStage)) return;
      const next = evs[i + 1];
      const end = next ? next.changedAt : now;
      const a = acc.get(e.toStage) ?? { total: 0, n: 0 };
      a.total += Math.max(0, (end.getTime() - e.changedAt.getTime()) / DAY);
      a.n++;
      acc.set(e.toStage, a);
    });
  }
  return OPEN_STAGES.map((stage) => {
    const a = acc.get(stage);
    return { stage, avgDays: a && a.n ? a.total / a.n : null, samples: a?.n ?? 0 };
  });
}

export const AGE_BUCKETS = ["0–30d", "31–60d", "61–90d", "90d+"] as const;

/** Open-deal aging (days since created) per stage, by amount. */
export function pipelineAging(opps: PipelineOpp[], now: Date) {
  const rows = OPEN_STAGES.map((stage) => ({ stage, buckets: AGE_BUCKETS.map(() => 0) }));
  for (const o of opps) {
    const r = rows.find((x) => x.stage === o.stage);
    if (!r) continue;
    const age = (now.getTime() - o.createdAt.getTime()) / DAY;
    r.buckets[age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3] += o.amount;
  }
  return rows;
}

/** New pipeline created per month (amount), last N months. */
export function pipelineCreationTrend(opps: PipelineOpp[], now: Date, months = 12) {
  const keys = nextPeriods(now, "month", months, -(months - 1));
  const map = new Map(keys.map((k) => [k, { month: k, amount: 0, count: 0 }]));
  for (const o of opps) {
    const b = map.get(monthKey(o.createdAt));
    if (b) {
      b.amount += o.amount;
      b.count++;
    }
  }
  return keys.map((k) => map.get(k)!);
}

export function pipelineByStage(opps: PipelineOpp[]) {
  return OPEN_STAGES.map((stage) => {
    const xs = opps.filter((o) => o.stage === stage);
    return { stage, amount: xs.reduce((s, o) => s + o.amount, 0), count: xs.length };
  });
}

export function pipelineByPractice(opps: PipelineOpp[], practiceIds: string[]) {
  return practiceIds
    .map((p) => {
      const xs = opps.filter((o) => isOpen(o.stage) && o.practiceArea === p);
      return { practiceArea: p, amount: xs.reduce((s, o) => s + o.amount, 0), count: xs.length };
    })
    .sort((a, b) => b.amount - a.amount);
}

export const ALL_STAGES = STAGES;
