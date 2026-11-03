import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = z
    .object({
      status: z.enum(["planned", "active", "paused", "complete"]),
      name: z.string().trim().min(2).max(160),
    })
    .partial()
    .parse(await readJson(req));
  return json(await db.campaign.update({ where: { id }, data: body }));
});

/** Deleting a campaign removes its still-planned touches; completed touches are kept as history. */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await db.touch.deleteMany({ where: { campaignId: id, completedAt: null } });
  await db.touch.updateMany({ where: { campaignId: id }, data: { campaignId: null } });
  await db.campaign.delete({ where: { id } });
  return json({ ok: true });
});
