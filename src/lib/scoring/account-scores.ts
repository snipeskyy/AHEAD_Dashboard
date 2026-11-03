import type { PrismaClient } from "@prisma/client";
import { practiceLabel } from "@/config/practice-areas";
import { MeddpiccSchema, OPEN_STAGES, PracticeStatusSchema, type Stage } from "@/lib/domain/enums";
import { readSetting } from "@/lib/settings/store";
import { dealRiskFlags } from "./deal-risk";
import { computeHealth, type HealthInputs } from "./health";
import { meddpiccCompleteness } from "./meddpicc";
import { computeWhitespace } from "./whitespace";

const DAY = 86_400_000;
const CORE_ROLES = new Set(["EconomicBuyer", "Champion", "Technical", "Influencer"]);

/** Loads everything needed to score an account. Shared by the scorer and the Account 360 breakdown UI. */
export async function loadScoreInputs(db: PrismaClient, accountIds: string[], now: Date) {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const [accounts, stalledDays] = await Promise.all([
    db.account.findMany({
      where: { id: { in: accountIds } },
      select: {
        id: true,
        contacts: { select: { buyingRole: true } },
        practiceStatus: { select: { practiceArea: true, status: true } },
        initiatives: { select: { practiceAreas: true, confidence: true } },
        opportunities: {
          select: {
            stage: true,
            stageChangedAt: true,
            closeDate: true,
            closeDatePushes: true,
            meddpicc: true,
            practiceArea: true,
            stageHistory: { where: { changedAt: { gte: since30 } }, select: { id: true } },
          },
        },
        touches: {
          where: { completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
        signals: {
          where: { publishedAt: { gte: since30 }, relevance: { gte: 40 }, dismissed: false },
          select: { practiceTags: true },
        },
      },
    }),
    readSetting(db, "modules.settings").then((m) => Number(m.opportunities?.stalledDays ?? 30)),
  ]);

  return accounts.map((a) => {
    const open = a.opportunities.filter((o) =>
      (OPEN_STAGES as readonly string[]).includes(o.stage),
    );
    const openParsed = open.map((o) => ({
      ...o,
      meddpicc: MeddpiccSchema.parse(o.meddpicc),
      stage: o.stage as Stage,
    }));
    const lastTouch = a.touches[0]?.completedAt ?? null;
    const health: HealthInputs = {
      daysSinceLastTouch: lastTouch ? (now.getTime() - lastTouch.getTime()) / DAY : null,
      coreRolesCovered: new Set(
        a.contacts.map((c) => c.buyingRole).filter((r) => CORE_ROLES.has(r)),
      ).size,
      stageChangesLast30d: a.opportunities.reduce((s, o) => s + o.stageHistory.length, 0),
      relevantSignalsLast30d: a.signals.length,
      avgMeddpicc: openParsed.length
        ? openParsed.reduce((s, o) => s + meddpiccCompleteness(o.meddpicc), 0) / openParsed.length
        : null,
      openOpps: openParsed.length,
      openOppsWithRisk: openParsed.filter((o) => dealRiskFlags(o, now, stalledDays).length > 0)
        .length,
    };
    // Demand per practice: max initiative confidence, plus signal mentions (capped).
    const demand: Record<string, number> = {};
    for (const i of a.initiatives)
      for (const p of i.practiceAreas as string[])
        demand[p] = Math.max(demand[p] ?? 0, i.confidence);
    for (const s of a.signals)
      for (const p of s.practiceTags as string[]) demand[p] = Math.min(1, (demand[p] ?? 0) + 0.1);
    const whitespace = a.practiceStatus.map((ps) => ({
      practiceArea: ps.practiceArea,
      label: practiceLabel(ps.practiceArea),
      status: PracticeStatusSchema.parse(ps.status),
      demand: demand[ps.practiceArea] ?? 0,
    }));
    return { accountId: a.id, health, whitespace, lastTouch };
  });
}

/** Recomputes and persists health + whitespace scores (and lastTouchAt / nextTouchAt). */
export async function computeScoresForAccounts(
  db: PrismaClient,
  opts: { now: Date; accountIds?: string[] },
) {
  const ids =
    opts.accountIds ?? (await db.account.findMany({ select: { id: true } })).map((a) => a.id);
  const [healthWeights, practiceWeights] = await Promise.all([
    readSetting(db, "scoring.health"),
    readSetting(db, "scoring.whitespacePracticeWeights"),
  ]);
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const inputs = await loadScoreInputs(db, batch, opts.now);
    const next = await db.touch.groupBy({
      by: ["accountId"],
      where: { accountId: { in: batch }, completedAt: null, scheduledAt: { gte: opts.now } },
      _min: { scheduledAt: true },
    });
    const nextMap = new Map(next.map((n) => [n.accountId, n._min.scheduledAt]));
    await db.$transaction(
      inputs.map((inp) =>
        db.account.update({
          where: { id: inp.accountId },
          data: {
            healthScore: computeHealth(inp.health, healthWeights).value,
            whitespaceScore: computeWhitespace(inp.whitespace, practiceWeights).value,
            lastTouchAt: inp.lastTouch,
            nextTouchAt: nextMap.get(inp.accountId) ?? null,
          },
        }),
      ),
    );
  }
}
