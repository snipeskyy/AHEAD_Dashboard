import { z } from "zod";
import { db } from "@/lib/db";
import { TouchChannelSchema } from "@/lib/domain/enums";
import { logActivity } from "@/lib/server/activity";
import { launchPlay } from "@/lib/server/campaigns";
import { HttpError, handler, json, readJson } from "@/lib/server/http";

const Body = z.discriminatedUnion("to", [
  z.object({
    to: z.literal("play"),
    playId: z.string().min(1),
    startDate: z.coerce.date().optional(),
    persona: z.string().max(120).optional(),
  }),
  z.object({
    to: z.literal("touch"),
    channel: TouchChannelSchema,
    persona: z.string().min(1).max(120),
    scheduledAt: z.coerce.date(),
    angle: z.string().max(500).optional(),
  }),
]);

/** Convert a signal into a play (campaign + touches) or a single planned touch. Opportunities use POST /api/opportunities with sourceSignalId. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = Body.parse(await readJson(req));
  const s = await db.signal.findUnique({
    where: { id },
    select: { id: true, accountId: true, title: true },
  });
  if (!s) throw new HttpError(404, "Signal not found");
  await db.signal.update({ where: { id }, data: { read: true } });
  if (body.to === "play") {
    const c = await launchPlay({
      playId: body.playId,
      accountId: s.accountId,
      startDate: body.startDate,
      persona: body.persona,
      sourceSignalId: s.id,
    });
    return json({ kind: "campaign", id: c.id, touches: c.touches.length }, { status: 201 });
  }
  const t = await db.touch.create({
    data: {
      accountId: s.accountId,
      channel: body.channel,
      persona: body.persona,
      scheduledAt: body.scheduledAt,
      angle: body.angle ?? `Re: ${s.title.slice(0, 160)}`,
      sourceSignalId: s.id,
    },
  });
  await logActivity({
    entityType: "account",
    entityId: s.accountId,
    action: "touch.planned",
    summary: `Planned ${body.channel} to ${body.persona} from signal`,
  });
  return json({ kind: "touch", id: t.id }, { status: 201 });
});
