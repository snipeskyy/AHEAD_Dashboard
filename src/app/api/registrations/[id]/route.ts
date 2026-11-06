import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";
import { RegistrationBody } from "@/lib/server/partners";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) =>
  json(await db.partnerRegistration.update({ where: { id: (await ctx.params).id }, data: RegistrationBody.partial().parse(await readJson(req)) })),
);
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await db.partnerRegistration.deleteMany({ where: { id: (await ctx.params).id } });
  return json({ ok: true });
});
