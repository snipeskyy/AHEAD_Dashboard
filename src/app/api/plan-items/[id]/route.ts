import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { handler, json, readJson } from "@/lib/server/http";
import { PlanItemBody } from "@/lib/domain/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = PlanItemBody.partial().parse(await readJson(req));
  const item = await db.accountPlanItem.update({ where: { id }, data: body });
  if (body.status)
    await logActivity({
      entityType: "account",
      entityId: item.accountId,
      action: "plan.updated",
      summary: `Plan item "${item.text.slice(0, 60)}" → ${body.status}`,
    });
  return json(item);
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  // Delete descendants (strategies/actions under an objective).
  const children = await db.accountPlanItem.findMany({
    where: { parentId: id },
    select: { id: true },
  });
  await db.accountPlanItem.deleteMany({
    where: { OR: [{ id }, { parentId: id }, { parentId: { in: children.map((c) => c.id) } }] },
  });
  return json({ ok: true });
});
