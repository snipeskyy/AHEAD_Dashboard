import { z } from "zod";
import { db } from "@/lib/db";
import { INVITE_STATUSES } from "@/lib/domain/enums";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const b = z
    .object({ status: z.enum(INVITE_STATUSES), persona: z.string().max(120).nullable() })
    .partial()
    .parse(await readJson(req));
  return json(await db.eventInvite.update({ where: { id: (await ctx.params).id }, data: b }));
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await db.eventInvite.delete({ where: { id: (await ctx.params).id } });
  return json({ ok: true });
});
