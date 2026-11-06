import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Rules, SmartEntity } from "@/lib/daily/smart-lists";
import { handler, HttpError, json, readJson } from "@/lib/server/http";
import { evaluate, SmartListBody } from "@/lib/server/smart-lists";

type Ctx = { params: Promise<{ id: string }> };

/** The list definition plus its current results. */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const l = await db.smartList.findUnique({ where: { id: (await ctx.params).id } });
  if (!l) throw new HttpError(404, "Smart list not found");
  return json({ list: l, results: await evaluate(l.entity as SmartEntity, l.rules as Rules) });
});
export const PATCH = handler(async (req: Request, ctx: Ctx) =>
  json(
    await db.smartList.update({
      where: { id: (await ctx.params).id },
      data: SmartListBody.partial().parse(await readJson(req)) as Prisma.SmartListUpdateInput,
    }),
  ),
);
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await db.smartList.deleteMany({ where: { id: (await ctx.params).id } });
  return json({ ok: true });
});
