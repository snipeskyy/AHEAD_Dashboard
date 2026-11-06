import { z } from "zod";
import { db } from "@/lib/db";
import { TouchChannelSchema } from "@/lib/domain/enums";
import { logActivity } from "@/lib/server/activity";
import { handler, json, readJson } from "@/lib/server/http";

const Query = z.object({
  accountId: z.string().optional(),
  campaignId: z.string().optional(),
  upcoming: z.enum(["true", "false"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(200),
});

export const GET = handler(async (req: Request) => {
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const now = new Date();
  const items = await db.touch.findMany({
    where: {
      accountId: q.accountId,
      campaignId: q.campaignId,
      ...(q.upcoming === "true" ? { completedAt: null, scheduledAt: { gte: now } } : {}),
      ...(q.from || q.to ? { scheduledAt: { gte: q.from, lt: q.to } } : {}),
    },
    orderBy: { scheduledAt: q.upcoming === "true" || q.from ? "asc" : "desc" },
    take: q.limit,
    include: {
      account: { select: { name: true, tier: true } },
      campaign: { select: { name: true } },
    },
  });
  return json({ items });
});

const Create = z.object({
  accountId: z.string().min(1),
  channel: TouchChannelSchema,
  persona: z.string().trim().min(1).max(120),
  angle: z.string().max(500).nullish(),
  scheduledAt: z.coerce.date(),
  completed: z.boolean().default(false),
  outcome: z.enum(["no-response", "replied", "meeting", "opp-created"]).nullish(),
  campaignId: z.string().nullish(),
  /** Joint touch with a partner rep (co-sell tracker). */
  partnerRepId: z.string().nullish(),
});

export const POST = handler(async (req: Request) => {
  const b = Create.parse(await readJson(req));
  const t = await db.touch.create({
    data: {
      accountId: b.accountId,
      channel: b.channel,
      persona: b.persona,
      angle: b.angle ?? null,
      scheduledAt: b.scheduledAt,
      completedAt: b.completed ? b.scheduledAt : null,
      outcome: b.completed ? (b.outcome ?? "no-response") : null,
      campaignId: b.campaignId ?? null,
      partnerRepId: b.partnerRepId ?? null,
    },
  });
  await logActivity({
    entityType: "account",
    entityId: b.accountId,
    action: b.completed ? "touch.logged" : "touch.planned",
    summary: `${b.completed ? "Logged" : "Planned"} ${b.channel} → ${b.persona}`,
  });
  return json(t, { status: 201 });
});
