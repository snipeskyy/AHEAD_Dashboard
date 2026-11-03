import "server-only";
import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain/enums";
import { deriveOpeningAngles, derivePainPoints } from "@/lib/intel/angles";
import { loadScoreInputs } from "@/lib/scoring/account-scores";
import { computeHealth } from "@/lib/scoring/health";
import { computeWhitespace } from "@/lib/scoring/whitespace";
import { getSetting } from "@/lib/settings/server";
import { HttpError } from "./http";

const DAY = 86_400_000;

export interface AccountRow {
  id: string;
  name: string;
  domain: string | null;
  ticker: string | null;
  industry: string;
  subIndustry: string | null;
  hq: string | null;
  employeeBand: string | null;
  revenueBand: string | null;
  tier: string;
  healthScore: number;
  whitespaceScore: number;
  openPipeline: number;
  openOpps: number;
  signals7d: number;
  lastTouchAt: string | null;
  nextTouchAt: string | null;
  isDemo: boolean;
}

export async function listAccounts(): Promise<AccountRow[]> {
  const since7 = new Date(Date.now() - 7 * DAY);
  const [accounts, pipe, sigs] = await Promise.all([
    db.account.findMany({ orderBy: { name: "asc" } }),
    db.opportunity.groupBy({
      by: ["accountId"],
      where: { stage: { in: [...OPEN_STAGES] } },
      _sum: { amount: true },
      _count: true,
    }),
    db.signal.groupBy({
      by: ["accountId"],
      where: { publishedAt: { gte: since7 }, dismissed: false },
      _count: true,
    }),
  ]);
  const p = new Map(pipe.map((x) => [x.accountId, x]));
  const s = new Map(sigs.map((x) => [x.accountId, x._count]));
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    domain: a.domain,
    ticker: a.ticker,
    industry: a.industry,
    subIndustry: a.subIndustry,
    hq: a.hq,
    employeeBand: a.employeeBand,
    revenueBand: a.revenueBand,
    tier: a.tier,
    healthScore: a.healthScore,
    whitespaceScore: a.whitespaceScore,
    openPipeline: p.get(a.id)?._sum.amount ?? 0,
    openOpps: p.get(a.id)?._count ?? 0,
    signals7d: s.get(a.id) ?? 0,
    lastTouchAt: a.lastTouchAt?.toISOString() ?? null,
    nextTouchAt: a.nextTouchAt?.toISOString() ?? null,
    isDemo: a.isDemo,
  }));
}

/** Everything Account 360 needs in one round trip (lists that can grow large are fetched per tab). */
export async function getAccount360(id: string) {
  const now = new Date();
  const a = await db.account.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { title: "asc" } },
      initiatives: { orderBy: { confidence: "desc" } },
      techStack: { orderBy: { confidence: "desc" } },
      practiceStatus: true,
      planItems: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!a) throw new HttpError(404, "Account not found");
  const [inputs, healthWeights, practiceWeights, opps, signals, lastTouch, nextTouch, touchCount] =
    await Promise.all([
      loadScoreInputs(db, [id], now),
      getSetting("scoring.health"),
      getSetting("scoring.whitespacePracticeWeights"),
      db.opportunity.findMany({
        where: { accountId: id },
        select: {
          stage: true,
          amount: true,
          probability: true,
          practiceArea: true,
          closeDate: true,
        },
      }),
      db.signal.findMany({
        where: { accountId: id, dismissed: false },
        orderBy: [{ relevance: "desc" }],
        take: 40,
        select: {
          id: true,
          title: true,
          type: true,
          practiceTags: true,
          url: true,
          source: true,
          publishedAt: true,
          relevance: true,
        },
      }),
      db.touch.findFirst({
        where: { accountId: id, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      }),
      db.touch.findFirst({
        where: { accountId: id, completedAt: null, scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
      }),
      db.touch.count({ where: { accountId: id } }),
    ]);
  const inp = inputs[0];
  const health = computeHealth(inp.health, healthWeights);
  const whitespace = computeWhitespace(inp.whitespace, practiceWeights);
  const open = opps.filter((o) => (OPEN_STAGES as readonly string[]).includes(o.stage));
  const statusMap = Object.fromEntries(a.practiceStatus.map((p) => [p.practiceArea, p.status]));
  const sigDTO = signals.map((s) => ({
    ...s,
    practiceTags: s.practiceTags as string[],
    publishedAt: s.publishedAt.toISOString(),
  }));
  const initDTO = a.initiatives.map((i) => ({ ...i, practiceAreas: i.practiceAreas as string[] }));
  const angleInputs = { initiatives: initDTO, signals: sigDTO, practiceStatus: statusMap };

  return {
    account: {
      id: a.id,
      name: a.name,
      domain: a.domain,
      ticker: a.ticker,
      cik: a.cik,
      industry: a.industry,
      subIndustry: a.subIndustry,
      hq: a.hq,
      employeeBand: a.employeeBand,
      revenueBand: a.revenueBand,
      tier: a.tier,
      ownerNotes: a.ownerNotes,
      isDemo: a.isDemo,
      sourceConfig: a.sourceConfig,
      healthScore: a.healthScore,
      whitespaceScore: a.whitespaceScore,
      createdAt: a.createdAt.toISOString(),
    },
    health,
    whitespace,
    contacts: a.contacts,
    initiatives: initDTO,
    techStack: a.techStack,
    practiceStatus: a.practiceStatus.map((p) => ({
      practiceArea: p.practiceArea,
      status: p.status,
    })),
    planItems: a.planItems.map((p) => ({ ...p, dueDate: p.dueDate?.toISOString() ?? null })),
    painPoints: derivePainPoints(angleInputs),
    openingAngles: deriveOpeningAngles(angleInputs),
    opps: {
      openCount: open.length,
      openAmount: open.reduce((s, o) => s + o.amount, 0),
      weighted: open.reduce((s, o) => s + (o.amount * o.probability) / 100, 0),
      wonAmount: opps.filter((o) => o.stage === "ClosedWon").reduce((s, o) => s + o.amount, 0),
      nextClose:
        open
          .map((o) => o.closeDate)
          .sort((x, y) => x.getTime() - y.getTime())[0]
          ?.toISOString() ?? null,
    },
    touches: {
      last: lastTouch
        ? {
            at: lastTouch.completedAt!.toISOString(),
            channel: lastTouch.channel,
            persona: lastTouch.persona,
            outcome: lastTouch.outcome,
          }
        : null,
      next: nextTouch
        ? {
            at: nextTouch.scheduledAt.toISOString(),
            channel: nextTouch.channel,
            persona: nextTouch.persona,
            angle: nextTouch.angle,
          }
        : null,
      total: touchCount,
    },
  };
}

export type Account360 = Awaited<ReturnType<typeof getAccount360>>;
