import { db } from "@/lib/db";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { handler, json, readJson } from "@/lib/server/http";
import { ContactBody } from "@/lib/domain/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const c = await db.contact.update({
    where: { id },
    data: ContactBody.partial().parse(await readJson(req)),
  });
  await computeScoresForAccounts(db, { now: new Date(), accountIds: [c.accountId] });
  return json(c);
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await db.contact.updateMany({ where: { reportsToId: id }, data: { reportsToId: null } });
  const c = await db.contact.delete({ where: { id } });
  await computeScoresForAccounts(db, { now: new Date(), accountIds: [c.accountId] });
  return json({ ok: true });
});
