import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { PlanItemBody } from "@/lib/domain/schemas";
import { handler, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = PlanItemBody.parse(await readJson(req));
  const item = await db.accountPlanItem.create({ data: { ...body, accountId: id } });
  await logActivity({
    entityType: "account",
    entityId: id,
    action: "plan.created",
    summary: `Plan ${body.kind} added: ${body.text.slice(0, 80)}`,
  });
  return json(item, { status: 201 });
});
