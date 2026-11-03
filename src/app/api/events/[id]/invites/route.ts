import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { HttpError, handler, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const b = z
    .object({ accountId: z.string().min(1), persona: z.string().max(120).nullish() })
    .parse(await readJson(req));
  if (await db.eventInvite.findFirst({ where: { eventId: id, accountId: b.accountId } }))
    throw new HttpError(409, "Account already invited");
  const inv = await db.eventInvite.create({
    data: { eventId: id, accountId: b.accountId, persona: b.persona ?? null, status: "planned" },
    include: { event: { select: { name: true } } },
  });
  await logActivity({
    entityType: "account",
    entityId: b.accountId,
    action: "event.invite",
    summary: `Added to event "${inv.event.name}"`,
  });
  return json(inv, { status: 201 });
});
