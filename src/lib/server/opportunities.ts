import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  CLOSED_STAGES,
  MeddpiccSchema,
  OPEN_STAGES,
  STAGE_DEFAULT_PROBABILITY,
  type Stage,
} from "@/lib/domain/enums";
import type { OppRow } from "@/lib/pipeline/types";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { dealRiskFlags } from "@/lib/scoring/deal-risk";
import { meddpiccCompleteness } from "@/lib/scoring/meddpicc";
import { getModuleSettings } from "@/lib/settings/server";
import { logActivity } from "./activity";
import { HttpError } from "./http";

const DAY = 86_400_000;
export const oppInclude = {
  account: { select: { name: true, tier: true, isDemo: true } },
} satisfies Prisma.OpportunityInclude;
type OppWithAccount = Prisma.OpportunityGetPayload<{ include: typeof oppInclude }>;

export async function stalledDays() {
  return (await getModuleSettings<{ stalledDays: number }>("opportunities")).stalledDays;
}

export function toOppRow(o: OppWithAccount, now: Date, stalled: number): OppRow {
  const meddpicc = MeddpiccSchema.parse(o.meddpicc);
  const stage = o.stage as Stage;
  return {
    id: o.id,
    accountId: o.accountId,
    accountName: o.account.name,
    accountTier: o.account.tier,
    accountIsDemo: o.account.isDemo,
    name: o.name,
    practiceArea: o.practiceArea,
    stage,
    amount: o.amount,
    weighted: Math.round((o.amount * o.probability) / 100),
    closeDate: o.closeDate.toISOString(),
    probability: o.probability,
    forecastCategory: o.forecastCategory,
    nextStep: o.nextStep,
    partners: o.partners as string[],
    competitors: o.competitors as string[],
    closeDatePushes: o.closeDatePushes,
    stageChangedAt: o.stageChangedAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
    closedAt: o.closedAt?.toISOString() ?? null,
    meddpiccScore: meddpiccCompleteness(meddpicc),
    riskFlags: dealRiskFlags(
      {
        stage,
        stageChangedAt: o.stageChangedAt,
        closeDate: o.closeDate,
        closeDatePushes: o.closeDatePushes,
        meddpicc,
      },
      now,
      stalled,
    ),
    daysInStage: Math.floor((now.getTime() - o.stageChangedAt.getTime()) / DAY),
  };
}

export async function listOpportunities(
  where: Prisma.OpportunityWhereInput = {},
): Promise<OppRow[]> {
  const now = new Date();
  const [rows, stalled] = await Promise.all([
    db.opportunity.findMany({ where, include: oppInclude, orderBy: { closeDate: "asc" } }),
    stalledDays(),
  ]);
  return rows.map((o) => toOppRow(o, now, stalled));
}

const defaultForecast = (stage: Stage) =>
  (CLOSED_STAGES as readonly string[]).includes(stage)
    ? "Closed"
    : stage === "Negotiate"
      ? "Commit"
      : stage === "Proposal"
        ? "BestCase"
        : "Pipeline";

/** Keeps the whitespace map consistent with pipeline: open opp ⇒ ActiveOpp, won ⇒ Delivered. */
async function syncPracticeStatus(
  tx: Prisma.TransactionClient,
  accountId: string,
  practiceArea: string,
  stage: Stage,
) {
  if (stage === "ClosedLost") return;
  const status = stage === "ClosedWon" ? "Delivered" : "ActiveOpp";
  const existing = await tx.accountPracticeStatus.findUnique({
    where: { accountId_practiceArea: { accountId, practiceArea } },
  });
  if (existing?.status === "Delivered") return;
  await tx.accountPracticeStatus.upsert({
    where: { accountId_practiceArea: { accountId, practiceArea } },
    create: { accountId, practiceArea, status },
    update: { status },
  });
}

export interface OppPatch {
  name?: string;
  stage?: Stage;
  amount?: number;
  closeDate?: Date;
  probability?: number;
  forecastCategory?: string;
  nextStep?: string | null;
  practiceArea?: string;
  partners?: string[];
  competitors?: string[];
  meddpicc?: unknown;
}

/** Applies a patch with business rules: stage history, default probability, push counting, practice sync, activity log. */
export async function updateOpportunity(id: string, patch: OppPatch) {
  const now = new Date();
  const prev = await db.opportunity.findUnique({ where: { id } });
  if (!prev) throw new HttpError(404, "Opportunity not found");
  const data: Prisma.OpportunityUpdateInput = {};
  const changes: string[] = [];
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.amount !== undefined && patch.amount !== prev.amount) {
    data.amount = patch.amount;
    changes.push(`amount → ${Math.round(patch.amount).toLocaleString("en-US")}`);
  }
  if (patch.nextStep !== undefined) data.nextStep = patch.nextStep;
  if (patch.practiceArea !== undefined) data.practiceArea = patch.practiceArea;
  if (patch.partners !== undefined) data.partners = patch.partners;
  if (patch.competitors !== undefined) data.competitors = patch.competitors;
  if (patch.meddpicc !== undefined) data.meddpicc = MeddpiccSchema.parse(patch.meddpicc);
  if (patch.probability !== undefined) data.probability = patch.probability;
  if (patch.forecastCategory !== undefined) data.forecastCategory = patch.forecastCategory;
  if (patch.closeDate !== undefined && patch.closeDate.getTime() !== prev.closeDate.getTime()) {
    data.closeDate = patch.closeDate;
    if (patch.closeDate > prev.closeDate) {
      data.closeDatePushes = prev.closeDatePushes + 1;
      changes.push(`close date pushed to ${patch.closeDate.toISOString().slice(0, 10)}`);
    } else changes.push(`close date pulled in to ${patch.closeDate.toISOString().slice(0, 10)}`);
  }
  const stageChanged = patch.stage !== undefined && patch.stage !== prev.stage;
  if (stageChanged) {
    const stage = patch.stage!;
    data.stage = stage;
    data.stageChangedAt = now;
    if (patch.probability === undefined) data.probability = STAGE_DEFAULT_PROBABILITY[stage];
    if (patch.forecastCategory === undefined) data.forecastCategory = defaultForecast(stage);
    data.closedAt = (CLOSED_STAGES as readonly string[]).includes(stage) ? now : null;
    if (stage === "ClosedWon" && patch.closeDate === undefined) data.closeDate = now;
    changes.unshift(`${prev.stage} → ${stage}`);
  }

  const updated = await db.$transaction(async (tx) => {
    const o = await tx.opportunity.update({ where: { id }, data, include: oppInclude });
    if (stageChanged) {
      await tx.stageChange.create({
        data: { opportunityId: id, fromStage: prev.stage, toStage: patch.stage!, changedAt: now },
      });
    }
    if (stageChanged || patch.practiceArea)
      await syncPracticeStatus(tx, o.accountId, o.practiceArea, o.stage as Stage);
    return o;
  });
  if (changes.length) {
    await logActivity({
      entityType: "opportunity",
      entityId: id,
      action: stageChanged ? "stage.changed" : "opportunity.updated",
      summary: `${updated.name}: ${changes.join(", ")}`,
      diff: { changes },
    });
  }
  await computeScoresForAccounts(db, { now, accountIds: [updated.accountId] });
  return toOppRow(updated, now, await stalledDays());
}

export interface OppCreate {
  accountId: string;
  name: string;
  practiceArea: string;
  stage: Stage;
  amount: number;
  closeDate: Date;
  nextStep?: string | null;
  sourceSignalId?: string | null;
}

export async function createOpportunity(input: OppCreate) {
  const now = new Date();
  const account = await db.account.findUnique({
    where: { id: input.accountId },
    select: { id: true },
  });
  if (!account) throw new HttpError(400, "Account not found");
  const empty = MeddpiccSchema.parse(
    Object.fromEntries(
      [
        "metrics",
        "economicBuyer",
        "decisionCriteria",
        "decisionProcess",
        "paperProcess",
        "identifyPain",
        "champion",
        "competition",
      ].map((k) => [k, { status: "unknown", notes: "" }]),
    ),
  );
  const o = await db.$transaction(async (tx) => {
    const created = await tx.opportunity.create({
      data: {
        ...input,
        probability: STAGE_DEFAULT_PROBABILITY[input.stage],
        forecastCategory: defaultForecast(input.stage),
        meddpicc: empty,
        partners: [],
        competitors: [],
        stageChangedAt: now,
        closedAt: (CLOSED_STAGES as readonly string[]).includes(input.stage) ? now : null,
        isDemo: false,
        stageHistory: { create: { fromStage: null, toStage: input.stage, changedAt: now } },
      },
      include: oppInclude,
    });
    await syncPracticeStatus(tx, input.accountId, input.practiceArea, input.stage);
    return created;
  });
  await logActivity({
    entityType: "opportunity",
    entityId: o.id,
    action: "opportunity.created",
    summary: `Created ${o.name} (${o.account.name})`,
  });
  await computeScoresForAccounts(db, { now, accountIds: [o.accountId] });
  return toOppRow(o, now, await stalledDays());
}

export const OPEN_STAGE_LIST = [...OPEN_STAGES];
