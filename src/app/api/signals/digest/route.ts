import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";
import { querySignals } from "@/lib/server/signals";

/** Daily / weekly digest: what happened across the portfolio, grouped for a quick read. */
export const GET = handler(async (req: Request) => {
  const { period } = z
    .object({ period: z.enum(["day", "week"]).default("day") })
    .parse(Object.fromEntries(new URL(req.url).searchParams));
  const since = new Date(Date.now() - (period === "day" ? 1 : 7) * 86_400_000);
  const where = { publishedAt: { gte: since }, dismissed: false };
  const [total, high, byType, byAccount, top, activeAccounts] = await Promise.all([
    db.signal.count({ where }),
    db.signal.count({ where: { ...where, relevance: { gte: 60 } } }),
    db.signal.groupBy({ by: ["type"], where, _count: true, orderBy: { _count: { type: "desc" } } }),
    db.signal.groupBy({
      by: ["accountId"],
      where: { ...where, relevance: { gte: 40 } },
      _count: true,
      _max: { relevance: true },
      orderBy: { _count: { accountId: "desc" } },
      take: 8,
    }),
    querySignals({ since, sort: "relevance", limit: 10 }),
    db.signal.groupBy({ by: ["accountId"], where }).then((r) => r.length),
  ]);
  const tagRows = await db.signal.findMany({ where, select: { practiceTags: true } });
  const byPractice = new Map<string, number>();
  for (const r of tagRows)
    for (const t of r.practiceTags as string[]) byPractice.set(t, (byPractice.get(t) ?? 0) + 1);
  const accounts = await db.account.findMany({
    where: { id: { in: byAccount.map((a) => a.accountId) } },
    select: { id: true, name: true, tier: true },
  });
  const accMap = new Map(accounts.map((a) => [a.id, a]));
  const accountTop = await Promise.all(
    byAccount.map((a) =>
      querySignals({ accountId: a.accountId, since, sort: "relevance", limit: 3 }),
    ),
  );
  return json({
    period,
    since: since.toISOString(),
    total,
    high,
    activeAccounts,
    byType: byType.map((t) => ({ type: t.type, count: t._count })),
    byPractice: [...byPractice.entries()]
      .map(([practice, count]) => ({ practice, count }))
      .sort((a, b) => b.count - a.count),
    accounts: byAccount.map((a, i) => ({
      accountId: a.accountId,
      name: accMap.get(a.accountId)?.name ?? "",
      tier: accMap.get(a.accountId)?.tier ?? "",
      count: a._count,
      maxRelevance: a._max.relevance ?? 0,
      top: accountTop[i].items,
    })),
    top: top.items,
  });
});
