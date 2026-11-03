import { z } from "zod";
import { db } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/settings/server";
import { handler, json } from "@/lib/server/http";

/**
 * "What changed since you last looked": ActivityLog + new high-relevance signals since ui.lastSeenAt.
 * POST marks everything as seen.
 */
export const GET = handler(async (req: Request) => {
  const q = z
    .object({ since: z.string().datetime().optional() })
    .parse(Object.fromEntries(new URL(req.url).searchParams));
  const stored = await getSetting("ui.lastSeenAt");
  const since = new Date(q.since ?? stored ?? Date.now() - 7 * 86_400_000);
  const [activity, signals, signalCount, stageChanges] = await Promise.all([
    db.activityLog.findMany({
      where: { createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.signal.findMany({
      where: { createdAt: { gt: since }, relevance: { gte: 60 }, dismissed: false },
      orderBy: { relevance: "desc" },
      take: 8,
      include: { account: { select: { name: true } } },
    }),
    db.signal.count({
      where: { createdAt: { gt: since }, relevance: { gte: 60 }, dismissed: false },
    }),
    db.activityLog.count({ where: { createdAt: { gt: since }, action: "stage.changed" } }),
  ]);
  return json({
    since: since.toISOString(),
    counts: { activity: activity.length, stageChanges, highSignals: signalCount },
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      summary: a.summary,
      at: a.createdAt.toISOString(),
      href: a.action.endsWith(".deleted")
        ? null
        : a.entityType === "opportunity"
          ? `/opportunities?focus=${a.entityId}`
          : a.entityType === "account"
            ? `/accounts/${a.entityId}`
            : null,
    })),
    signals: signals.map((s) => ({
      id: s.id,
      title: s.title,
      accountId: s.accountId,
      accountName: s.account.name,
      relevance: s.relevance,
      at: s.publishedAt.toISOString(),
    })),
  });
});

export const POST = handler(async () => {
  const now = new Date().toISOString();
  await setSetting("ui.lastSeenAt", now);
  return json({ lastSeenAt: now });
});
