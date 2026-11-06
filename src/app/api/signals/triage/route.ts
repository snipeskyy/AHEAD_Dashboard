import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";
import { querySignalsByIds } from "@/lib/server/signals";

const DAY = 86_400_000;

/** Triage queue: un-triaged, not dismissed, last 30 days, most relevant first. Plus inbox-zero and weekly stats. */
export const GET = handler(async () => {
  const now = Date.now();
  const where = { triagedAt: null, dismissed: false, publishedAt: { gte: new Date(now - 30 * DAY) } };
  const [ids, remaining, week, today] = await Promise.all([
    db.signal.findMany({ where, orderBy: [{ relevance: "desc" }, { publishedAt: "desc" }], take: 100, select: { id: true } }),
    db.signal.count({ where }),
    db.signal.groupBy({ by: ["triageAction"], where: { triagedAt: { gte: new Date(now - 7 * DAY) } }, _count: true }),
    db.signal.count({ where: { triagedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);
  const rows = await querySignalsByIds(ids.map((i) => i.id));
  const order = new Map(ids.map((x, i) => [x.id, i]));
  return json({
    items: rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!),
    remaining,
    triagedToday: today,
    week: Object.fromEntries(week.map((w) => [w.triageAction ?? "read", w._count])),
  });
});
