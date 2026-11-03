import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

export interface ActivityItem {
  id: string;
  kind: "activity" | "touch" | "note" | "signal";
  at: string;
  title: string;
  detail: string | null;
  href: string | null;
}

/** Unified account timeline: changes, touches, notes and high-relevance signals. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const oppIds = (
    await db.opportunity.findMany({ where: { accountId: id }, select: { id: true } })
  ).map((o) => o.id);
  const [acts, touches, notes, signals] = await Promise.all([
    db.activityLog.findMany({
      where: {
        OR: [
          { entityType: "account", entityId: id },
          { entityType: "opportunity", entityId: { in: oppIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.touch.findMany({ where: { accountId: id }, orderBy: { scheduledAt: "desc" }, take: 60 }),
    db.note.findMany({
      where: { entityType: "account", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.signal.findMany({
      where: { accountId: id, relevance: { gte: 40 } },
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
  ]);
  const items: ActivityItem[] = [
    ...acts.map((a) => ({
      id: a.id,
      kind: "activity" as const,
      at: a.createdAt.toISOString(),
      title: a.summary,
      detail: a.action,
      href: a.entityType === "opportunity" ? `/opportunities?focus=${a.entityId}` : null,
    })),
    ...touches.map((t) => ({
      id: t.id,
      kind: "touch" as const,
      at: (t.completedAt ?? t.scheduledAt).toISOString(),
      title: `${t.completedAt ? "" : "Planned: "}${t.channel} → ${t.persona}`,
      detail: [t.angle, t.outcome].filter(Boolean).join(" · ") || null,
      href: null,
    })),
    ...notes.map((n) => ({
      id: n.id,
      kind: "note" as const,
      at: n.createdAt.toISOString(),
      title: n.body.slice(0, 140),
      detail: null,
      href: null,
    })),
    ...signals.map((s) => ({
      id: s.id,
      kind: "signal" as const,
      at: s.publishedAt.toISOString(),
      title: s.title,
      detail: s.type,
      href: `/signals?focus=${s.id}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return json({ items: items.slice(0, 150) });
});
