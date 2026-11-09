import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { MapPatchSchema, MapStepsSchema, starterSteps, type MapStep } from "@/lib/map/model";
import { logActivity } from "./activity";
import { HttpError } from "./http";

/** Mutual action plans (Phase 14): one per opportunity. Steps are a validated JSON list. */
const shortId = () => randomUUID().slice(0, 8);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const asDate = (s: string | null | undefined) => (s ? new Date(`${s}T12:00:00.000Z`) : null);

export interface PlanDto {
  id: string;
  opportunityId: string;
  title: string;
  objective: string | null;
  targetDate: string | null;
  steps: MapStep[];
  updatedAt: string;
  opportunity: {
    id: string;
    name: string;
    stage: string;
    closeDate: string;
    accountId: string;
    accountName: string;
  };
}

const include = {
  opportunity: { include: { account: { select: { id: true, name: true } } } },
} satisfies Prisma.MutualActionPlanInclude;
type Row = Prisma.MutualActionPlanGetPayload<{ include: typeof include }>;

const toDto = (p: Row): PlanDto => ({
  id: p.id,
  opportunityId: p.opportunityId,
  title: p.title,
  objective: p.objective,
  targetDate: day(p.targetDate),
  steps: MapStepsSchema.catch([]).parse(p.steps),
  updatedAt: p.updatedAt.toISOString(),
  opportunity: {
    id: p.opportunity.id,
    name: p.opportunity.name,
    stage: p.opportunity.stage,
    closeDate: p.opportunity.closeDate.toISOString(),
    accountId: p.opportunity.account.id,
    accountName: p.opportunity.account.name,
  },
});

export async function getPlan(opportunityId: string): Promise<PlanDto | null> {
  const p = await db.mutualActionPlan.findUnique({ where: { opportunityId }, include });
  return p ? toDto(p) : null;
}

/** Creates the plan, optionally from the generic starter path (dates count back from the deal's close date). */
export async function createPlan(opportunityId: string, opts: { starter: boolean }) {
  const o = await db.opportunity.findUnique({
    where: { id: opportunityId },
    include: { account: { select: { name: true } } },
  });
  if (!o) throw new HttpError(404, "Opportunity not found");
  if (await db.mutualActionPlan.findUnique({ where: { opportunityId } }))
    throw new HttpError(409, "This opportunity already has a plan");
  const target = day(o.closeDate);
  const steps = opts.starter ? starterSteps(target, new Date(), shortId) : [];
  const p = await db.mutualActionPlan.create({
    data: {
      opportunityId,
      title: `${o.account.name}: ${o.name}`.slice(0, 160),
      targetDate: o.closeDate,
      steps: steps as unknown as Prisma.InputJsonValue,
    },
    include,
  });
  await logActivity({
    entityType: "opportunity",
    entityId: opportunityId,
    action: "plan.created",
    summary: `Mutual action plan started for ${o.name}`,
  });
  return toDto(p);
}

export async function updatePlan(opportunityId: string, raw: unknown) {
  const patch = MapPatchSchema.parse(raw);
  const ids = patch.steps?.map((s) => s.id) ?? [];
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "Step ids must be unique");
  const existing = await db.mutualActionPlan.findUnique({ where: { opportunityId } });
  if (!existing) throw new HttpError(404, "No plan for this opportunity");
  const p = await db.mutualActionPlan.update({
    where: { opportunityId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.objective !== undefined ? { objective: patch.objective } : {}),
      ...(patch.targetDate !== undefined ? { targetDate: asDate(patch.targetDate) } : {}),
      ...(patch.steps ? { steps: patch.steps as unknown as Prisma.InputJsonValue } : {}),
    },
    include,
  });
  return toDto(p);
}

export async function deletePlan(opportunityId: string) {
  const p = await db.mutualActionPlan.findUnique({ where: { opportunityId } });
  if (!p) throw new HttpError(404, "No plan for this opportunity");
  await db.mutualActionPlan.delete({ where: { id: p.id } });
  return { ok: true };
}

/** Plans for an account's opportunities (export section and Account 360). */
export async function plansForAccount(accountId: string) {
  const rows = await db.mutualActionPlan.findMany({
    where: { opportunity: { accountId } },
    include,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toDto);
}

export async function auditPlanShare(opportunityId: string, audience: string) {
  await audit(db, {
    action: "plan.export",
    entityType: "opportunity",
    entityId: opportunityId,
    summary: `Exported the mutual action plan (${audience})`,
  });
}
