import { z } from "zod";
import { db } from "@/lib/db";
import { CLOSE_REASONS, FORECAST_CATEGORIES, MeddpiccSchema, StageSchema } from "@/lib/domain/enums";
import { logActivity } from "@/lib/server/activity";
import { HttpError, handler, json, readJson } from "@/lib/server/http";
import { oppInclude, stalledDays, toOppRow, updateOpportunity } from "@/lib/server/opportunities";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const o = await db.opportunity.findUnique({
    where: { id },
    include: { ...oppInclude, stageHistory: { orderBy: { changedAt: "asc" } } },
  });
  if (!o) throw new HttpError(404, "Opportunity not found");
  const notes = await db.note.findMany({
    where: { entityType: "opportunity", entityId: id },
    orderBy: { createdAt: "desc" },
  });
  return json({
    ...toOppRow(o, new Date(), await stalledDays()),
    meddpicc: MeddpiccSchema.parse(o.meddpicc),
    stageHistory: o.stageHistory.map((h) => ({
      id: h.id,
      fromStage: h.fromStage,
      toStage: h.toStage,
      changedAt: h.changedAt.toISOString(),
    })),
    notes,
  });
});

const Patch = z
  .object({
    name: z.string().trim().min(2).max(160),
    stage: StageSchema,
    amount: z.number().min(0).max(1e10),
    closeDate: z.coerce.date(),
    probability: z.number().int().min(0).max(100),
    forecastCategory: z.enum(FORECAST_CATEGORIES),
    nextStep: z.string().max(500).nullable(),
    nextStepDate: z.coerce.date().nullable(),
    closeReason: z.enum(CLOSE_REASONS).nullable(),
    practiceArea: z.string().min(1),
    partners: z.array(z.string().max(80)).max(20),
    competitors: z.array(z.string().max(80)).max(20),
    meddpicc: MeddpiccSchema,
  })
  .partial()
  .strict();

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(await updateOpportunity(id, Patch.parse(await readJson(req))));
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const o = await db.opportunity.delete({ where: { id } });
  await logActivity({
    entityType: "opportunity",
    entityId: id,
    action: "opportunity.deleted",
    summary: `Deleted ${o.name}`,
  });
  return json({ ok: true });
});
