import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";
import { RepBody } from "@/lib/server/partners";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const id = (await ctx.params).id;
  const { accountIds, ...b } = RepBody.partial().parse(await readJson(req));
  if (accountIds) {
    await db.partnerRepAccount.deleteMany({ where: { repId: id } });
    if (accountIds.length) await db.partnerRepAccount.createMany({ data: accountIds.map((accountId) => ({ repId: id, accountId })) });
  }
  return json(await db.partnerRep.update({ where: { id }, data: b }));
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await db.partnerRep.deleteMany({ where: { id: (await ctx.params).id } });
  return json({ ok: true });
});
