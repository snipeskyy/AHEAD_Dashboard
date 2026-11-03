import { db } from "@/lib/db";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { logActivity } from "@/lib/server/activity";
import { ContactBody } from "@/lib/domain/schemas";
import { handler, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = ContactBody.parse(await readJson(req));
  const c = await db.contact.create({ data: { ...body, accountId: id } });
  await computeScoresForAccounts(db, { now: new Date(), accountIds: [id] });
  await logActivity({
    entityType: "account",
    entityId: id,
    action: "contact.created",
    summary: `Added persona ${c.title} (${c.buyingRole})`,
  });
  return json(c, { status: 201 });
});
