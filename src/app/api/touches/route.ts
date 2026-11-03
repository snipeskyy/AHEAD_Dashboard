import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

const Query = z.object({
  accountId: z.string().optional(),
  upcoming: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const GET = handler(async (req: Request) => {
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const now = new Date();
  const items = await db.touch.findMany({
    where: {
      accountId: q.accountId,
      ...(q.upcoming === "true" ? { completedAt: null, scheduledAt: { gte: now } } : {}),
    },
    orderBy: { scheduledAt: q.upcoming === "true" ? "asc" : "desc" },
    take: q.limit,
    include: { account: { select: { name: true } }, campaign: { select: { name: true } } },
  });
  return json({ items });
});
