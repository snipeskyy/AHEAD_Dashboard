import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";
import { recommendForAccount } from "@/lib/server/plays";

/** Top recommendation for each Strategic account (and top-whitespace Growth accounts). */
export const GET = handler(async () => {
  const accounts = await db.account.findMany({
    where: { OR: [{ tier: "Strategic" }, { tier: "Growth", whitespaceScore: { gte: 55 } }] },
    select: { id: true },
    orderBy: [{ tier: "asc" }, { whitespaceScore: "desc" }],
    take: 30,
  });
  const recs = await Promise.all(accounts.map((a) => recommendForAccount(a.id, 1)));
  return json({
    items: recs
      .filter((r) => r.items.length)
      .map((r) => ({ account: r.account, top: r.items[0] }))
      .sort((a, b) => b.top.score - a.top.score),
  });
});
