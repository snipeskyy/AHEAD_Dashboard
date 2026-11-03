import { z } from "zod";
import { db } from "@/lib/db";
import { TouchChannelSchema } from "@/lib/domain/enums";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { logActivity } from "@/lib/server/activity";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Patch = z
  .object({
    scheduledAt: z.coerce.date(),
    channel: TouchChannelSchema,
    persona: z.string().trim().min(1).max(120),
    angle: z.string().max(500).nullable(),
    completed: z.boolean(),
    outcome: z.enum(["no-response", "replied", "meeting", "opp-created"]).nullable(),
  })
  .partial();

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { completed, ...rest } = Patch.parse(await readJson(req));
  const prev = await db.touch.findUniqueOrThrow({ where: { id } });
  const data: Record<string, unknown> = { ...rest };
  if (completed === true) {
    data.completedAt =
      prev.completedAt ??
      new Date(Math.min(Date.now(), (rest.scheduledAt ?? prev.scheduledAt).getTime()));
    data.outcome = rest.outcome ?? prev.outcome ?? "no-response";
  } else if (completed === false) {
    data.completedAt = null;
    data.outcome = null;
  }
  const t = await db.touch.update({ where: { id }, data });
  if (rest.scheduledAt && !completed)
    await logActivity({
      entityType: "account",
      entityId: t.accountId,
      action: "touch.rescheduled",
      summary: `Rescheduled ${t.channel} → ${t.persona} to ${rest.scheduledAt.toISOString().slice(0, 10)}`,
    });
  if (completed !== undefined) {
    await logActivity({
      entityType: "account",
      entityId: t.accountId,
      action: "touch.completed",
      summary: `${t.channel} → ${t.persona}: ${t.outcome ?? "planned"}`,
    });
    await computeScoresForAccounts(db, { now: new Date(), accountIds: [t.accountId] });
  }
  return json(t);
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await db.touch.delete({ where: { id } });
  return json({ ok: true });
});
