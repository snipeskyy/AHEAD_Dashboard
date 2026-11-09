import { CLOSE_REASONS, OPEN_STAGES } from "@/lib/domain/enums";
import { nextPeriods, quarterKey } from "./analytics";
import type { PipelineOpp, StageEvent } from "./types";

/**
 * Win/loss and pipeline-trend analytics (Phase 14). Pure: computed client-side from the filtered rows, like the
 * rest of the Opportunities analytics. Every number is a count or average of the user's own deals; nothing is
 * modeled or invented.
 */
const DAY = 86_400_000;
const won = (o: PipelineOpp) => o.stage === "ClosedWon";
const lost = (o: PipelineOpp) => o.stage === "ClosedLost";
const closed = (o: PipelineOpp) => (won(o) || lost(o)) && !!o.closedAt;
const cycleDays = (o: PipelineOpp) =>
  Math.max(0, (o.closedAt!.getTime() - o.createdAt.getTime()) / DAY);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const rate = (w: number, l: number) => (w + l ? w / (w + l) : null);

/** The last `n` quarters, oldest first, ending with the current one. */
export const lastQuarters = (now: Date, n: number) => nextPeriods(now, "quarter", n, -(n - 1));

export interface QuarterWinLoss {
  quarter: string;
  won: number;
  lost: number;
  wonAmount: number;
  lostAmount: number;
  /** Won ÷ (won + lost), by count; null when nothing closed. */
  winRate: number | null;
  /** Average days from created to closed, won deals only. */
  avgCycleDays: number | null;
}

/** Deals closed per quarter (by close date of record): counts, amounts, win rate, cycle time. */
export function winLossByQuarter(opps: PipelineOpp[], now: Date, n = 6): QuarterWinLoss[] {
  const qs = lastQuarters(now, n);
  return qs.map((quarter) => {
    const inQ = opps.filter((o) => closed(o) && quarterKey(o.closedAt!) === quarter);
    const w = inQ.filter(won);
    const l = inQ.filter(lost);
    return {
      quarter,
      won: w.length,
      lost: l.length,
      wonAmount: w.reduce((s, o) => s + o.amount, 0),
      lostAmount: l.reduce((s, o) => s + o.amount, 0),
      winRate: rate(w.length, l.length),
      avgCycleDays: avg(w.map(cycleDays)),
    };
  });
}

export interface PracticeWinLoss {
  practice: string;
  won: number;
  lost: number;
  winRate: number | null;
  avgCycleDays: number | null;
  wonAmount: number;
}

/** Win rate and cycle time per practice area over the last `n` quarters (practices with no closed deals omitted). */
export function winLossByPractice(
  opps: PipelineOpp[],
  practiceIds: string[],
  now: Date,
  n = 4,
): PracticeWinLoss[] {
  const qs = new Set(lastQuarters(now, n));
  const recent = opps.filter((o) => closed(o) && qs.has(quarterKey(o.closedAt!)));
  return practiceIds
    .map((practice) => {
      const p = recent.filter((o) => o.practiceArea === practice);
      const w = p.filter(won);
      const l = p.filter(lost);
      return {
        practice,
        won: w.length,
        lost: l.length,
        winRate: rate(w.length, l.length),
        avgCycleDays: avg(w.map(cycleDays)),
        wonAmount: w.reduce((s, o) => s + o.amount, 0),
      };
    })
    .filter((r) => r.won + r.lost > 0);
}

export const COHORT_MILESTONES = ["Solution", "Proposal", "ClosedWon"] as const;

export interface Cohort {
  quarter: string;
  created: number;
  /** Deals of this cohort that reached each milestone (by stage history or current stage). */
  reached: Record<(typeof COHORT_MILESTONES)[number], number>;
  stillOpen: number;
}

/**
 * Stage conversion over time: deals grouped by the quarter they were created, and how many have reached Solution,
 * Proposal and Closed Won so far. Recent cohorts are young, which the UI says next to the chart.
 */
export function cohortConversion(
  opps: PipelineOpp[],
  events: StageEvent[],
  now: Date,
  n = 6,
): Cohort[] {
  const order = [...OPEN_STAGES, "ClosedWon"] as string[];
  const best = new Map<string, number>();
  for (const e of events)
    best.set(e.opportunityId, Math.max(best.get(e.opportunityId) ?? -1, order.indexOf(e.toStage)));
  const qs = lastQuarters(now, n);
  return qs.map((quarter) => {
    const c = opps.filter((o) => quarterKey(o.createdAt) === quarter);
    const reachedIdx = (o: PipelineOpp) =>
      Math.max(order.indexOf(o.stage), o.id ? (best.get(o.id) ?? -1) : -1);
    const reached = Object.fromEntries(
      COHORT_MILESTONES.map((m) => [m, c.filter((o) => reachedIdx(o) >= order.indexOf(m)).length]),
    ) as Cohort["reached"];
    return {
      quarter,
      created: c.length,
      reached,
      stillOpen: c.filter((o) => !won(o) && !lost(o)).length,
    };
  });
}

export interface ReasonCount {
  reason: string;
  won: number;
  lost: number;
}

/** Close reasons the user recorded, over the last `n` quarters; deals without a reason count as "unrecorded". */
export function closeReasons(
  opps: PipelineOpp[],
  now: Date,
  n = 4,
): { rows: ReasonCount[]; unrecorded: number } {
  const qs = new Set(lastQuarters(now, n));
  const recent = opps.filter((o) => closed(o) && qs.has(quarterKey(o.closedAt!)));
  const rows = CLOSE_REASONS.map((reason) => ({
    reason,
    won: recent.filter((o) => won(o) && o.closeReason === reason).length,
    lost: recent.filter((o) => lost(o) && o.closeReason === reason).length,
  })).filter((r) => r.won + r.lost > 0);
  return { rows, unrecorded: recent.filter((o) => !o.closeReason).length };
}

/**
 * One computed sentence for the trend: win rate over the most recent half of the window vs the earlier half.
 * Returns null when either half has fewer than 3 closed deals (too few to say anything).
 */
export function winRateTakeaway(q: QuarterWinLoss[]): string | null {
  const half = Math.floor(q.length / 2);
  const sum = (xs: QuarterWinLoss[]) =>
    xs.reduce((s, x) => ({ w: s.w + x.won, l: s.l + x.lost }), { w: 0, l: 0 });
  const a = sum(q.slice(0, half));
  const b = sum(q.slice(half));
  if (a.w + a.l < 3 || b.w + b.l < 3) return null;
  const ra = a.w / (a.w + a.l);
  const rb = b.w / (b.w + b.l);
  const pts = Math.round((rb - ra) * 100);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const span = `the last ${q.length - half} quarters`;
  if (pts === 0) return `Win rate held at ${pct(rb)} over ${span} (${b.w} won, ${b.l} lost).`;
  return `Win rate ${pts > 0 ? "rose" : "fell"} to ${pct(rb)} over ${span}, from ${pct(ra)} in the ${half} before (${b.w} won, ${b.l} lost).`;
}
