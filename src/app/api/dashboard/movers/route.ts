import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain/enums";
import { topMovers, type MoverInput } from "@/lib/dashboard/movers";
import { handler, json } from "@/lib/server/http";

const ORDER = [...OPEN_STAGES, "ClosedWon"] as string[];

export const GET = handler(async () => {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [accounts, changes, created, signals] = await Promise.all([
    db.account.findMany({ select: { id: true, name: true, tier: true } }),
    db.stageChange.findMany({
      where: { changedAt: { gte: since }, fromStage: { not: null } },
      include: { opportunity: { select: { accountId: true, amount: true } } },
    }),
    db.opportunity.findMany({
      where: { createdAt: { gte: since } },
      select: { accountId: true, amount: true },
    }),
    db.signal.groupBy({
      by: ["accountId"],
      where: { publishedAt: { gte: since }, relevance: { gte: 50 }, dismissed: false },
      _count: true,
    }),
  ]);
  const m = new Map<string, MoverInput>(
    accounts.map((a) => [
      a.id,
      {
        accountId: a.id,
        accountName: a.name,
        tier: a.tier,
        advances: 0,
        setbacks: 0,
        wonAmount: 0,
        newPipeline: 0,
        highSignals: 0,
      },
    ]),
  );
  for (const c of changes) {
    const r = m.get(c.opportunity.accountId);
    if (!r) continue;
    if (c.toStage === "ClosedLost" || ORDER.indexOf(c.toStage) < ORDER.indexOf(c.fromStage!))
      r.setbacks++;
    else r.advances++;
    if (c.toStage === "ClosedWon") r.wonAmount += c.opportunity.amount;
  }
  for (const o of created) {
    const r = m.get(o.accountId);
    if (r) r.newPipeline += o.amount;
  }
  for (const s of signals) {
    const r = m.get(s.accountId);
    if (r) r.highSignals = s._count;
  }
  return json({ items: topMovers([...m.values()], 10) });
});
