import { z } from "zod";
import { db } from "@/lib/db";
import { LayoutWidgetsSchema } from "@/lib/dashboard/layouts";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Patch = z
  .object({
    name: z.string().trim().min(1).max(60),
    widgets: LayoutWidgetsSchema,
    isDefault: z.boolean(),
  })
  .partial();

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = Patch.parse(await readJson(req));
  if (body.isDefault) await db.dashboardLayout.updateMany({ data: { isDefault: false } });
  return json(await db.dashboardLayout.update({ where: { id }, data: body }));
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await db.dashboardLayout.delete({ where: { id } });
  return json({ ok: true });
});
