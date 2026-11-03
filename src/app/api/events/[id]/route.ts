import { z } from "zod";
import { db } from "@/lib/db";
import { EVENT_KINDS } from "@/lib/domain/enums";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = z
    .object({
      name: z.string().trim().min(3).max(160),
      kind: z.enum(EVENT_KINDS),
      startsAt: z.coerce.date(),
      location: z.string().trim().max(160).nullable(),
    })
    .partial()
    .parse(await readJson(req));
  return json(await db.event.update({ where: { id }, data: b }));
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await db.event.delete({ where: { id: (await ctx.params).id } });
  return json({ ok: true });
});
