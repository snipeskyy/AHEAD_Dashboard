import "server-only";
import type { Tier } from "@/lib/domain/enums";
import { db } from "@/lib/db";
import { cadenceState, type CadenceDays } from "@/lib/daily/cadence";
import { planningWindow, type PlanningConfig } from "@/lib/daily/fiscal";
import { getModuleSettings } from "@/lib/settings/server";
import { enrichmentOverview } from "./enrichment";

const DAY = 86_400_000;

export async function territoryConfig() {
  const s = await getModuleSettings<{ strategicDays: number; growthDays: number; maintainDays: number; planningStartMonths: number; planningEndMonths: number }>("territory");
  const cadence: CadenceDays = { Strategic: s.strategicDays, Growth: s.growthDays, Maintain: s.maintainDays };
  const planning: PlanningConfig = { startMonthsBefore: s.planningStartMonths, endMonthsBefore: s.planningEndMonths };
  return { cadence, planning };
}

/** Every account with cadence, momentum (last 14 days) and budget timing. */
export async function territory(now = new Date()) {
  const { cadence, planning } = await territoryConfig();
  const since = new Date(now.getTime() - 14 * DAY);
  const [accounts, sig, stage, touches, newOpps, pipe] = await Promise.all([
    db.account.findMany({ select: { id: true, name: true, tier: true, healthScore: true, whitespaceScore: true, lastTouchAt: true, fiscalYearEnd: true, industry: true } }),
    db.signal.groupBy({ by: ["accountId"], where: { publishedAt: { gte: since }, dismissed: false }, _count: true, _avg: { relevance: true } }),
    db.stageChange.findMany({ where: { changedAt: { gte: since }, fromStage: { not: null } }, select: { opportunity: { select: { accountId: true } } } }),
    db.touch.groupBy({ by: ["accountId"], where: { completedAt: { gte: since } }, _count: true }),
    db.opportunity.groupBy({ by: ["accountId"], where: { createdAt: { gte: since } }, _count: true }),
    db.opportunity.groupBy({ by: ["accountId"], where: { stage: { notIn: ["ClosedWon", "ClosedLost"] } }, _sum: { amount: true } }),
  ]);
  const S = new Map(sig.map((x) => [x.accountId, x]));
  const T = new Map(touches.map((x) => [x.accountId, x._count]));
  const N = new Map(newOpps.map((x) => [x.accountId, x._count]));
  const P = new Map(pipe.map((x) => [x.accountId, x._sum.amount ?? 0]));
  const M = new Map<string, number>();
  for (const s of stage) M.set(s.opportunity.accountId, (M.get(s.opportunity.accountId) ?? 0) + 1);
  const rows = accounts.map((a) => {
    const c = cadenceState(a.tier as Tier, a.lastTouchAt, now, cadence);
    const s = S.get(a.id);
    const parts = {
      signals: Math.round((s?._count ?? 0) * ((s?._avg.relevance ?? 0) / 100) * 10) / 10,
      stageMoves: (M.get(a.id) ?? 0) * 3,
      touches: T.get(a.id) ?? 0,
      newOpps: (N.get(a.id) ?? 0) * 4,
    };
    const fw = planningWindow(a.fiscalYearEnd, now, planning);
    return {
      id: a.id, name: a.name, tier: a.tier, industry: a.industry, healthScore: a.healthScore, whitespaceScore: a.whitespaceScore,
      openPipeline: P.get(a.id) ?? 0,
      lastTouchAt: a.lastTouchAt?.toISOString() ?? null,
      cadenceDays: cadence[a.tier as Tier],
      cadence: { ...c, dueAt: c.dueAt?.toISOString() ?? null },
      momentum: Math.round((parts.signals + parts.stageMoves + parts.touches + parts.newOpps) * 10) / 10,
      momentumParts: parts,
      fiscal: fw ? { fye: a.fiscalYearEnd, phase: fw.phase, label: fw.label, start: fw.start.toISOString(), end: fw.end.toISOString(), fiscalYearStart: fw.fiscalYearStart.toISOString(), weeksUntilStart: fw.weeksUntilStart } : null,
    };
  });
  const tierRank = { Strategic: 0, Growth: 1, Maintain: 2 } as Record<string, number>;
  const neglected = rows
    .filter((r) => r.cadence.status === "overdue" || r.cadence.status === "never")
    .sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || b.cadence.overdueDays - a.cadence.overdueDays)
    .slice(0, 15);
  const momentum = rows.filter((r) => r.momentum > 0).sort((a, b) => b.momentum - a.momentum).slice(0, 15);
  return { rows, neglected, momentum, cadence };
}

/** Most valuable missing fields across the portfolio (weight × tier priority). */
export async function fixItQueue(limit = 150) {
  const [ov, accounts] = await Promise.all([enrichmentOverview(), db.account.findMany({ where: { isDemo: false }, select: { id: true, name: true, tier: true } })]);
  const A = new Map(accounts.map((a) => [a.id, a]));
  const tierBoost = { Strategic: 3, Growth: 2, Maintain: 1 } as Record<string, number>;
  return ov
    .flatMap((o) => {
      const a = A.get(o.accountId);
      return a ? o.missing.map((m) => ({ accountId: a.id, accountName: a.name, tier: a.tier, ...m, score: m.weight * tierBoost[a.tier] })) : [];
    })
    .sort((x, y) => y.score - x.score || x.accountName.localeCompare(y.accountName))
    .slice(0, limit);
}
