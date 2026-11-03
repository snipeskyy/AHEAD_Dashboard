import { db } from "@/lib/db";
import { nextBestActions } from "@/lib/dashboard/next-actions";
import { OPEN_STAGES } from "@/lib/domain/enums";
import { listOpportunities } from "@/lib/server/opportunities";
import { handler, json } from "@/lib/server/http";

export const GET = handler(async () => {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const [opps, accounts, sig, plan] = await Promise.all([
    listOpportunities({ stage: { in: [...OPEN_STAGES] } }),
    db.account.findMany({
      select: { id: true, name: true, tier: true, lastTouchAt: true, nextTouchAt: true },
    }),
    db.signal.groupBy({
      by: ["accountId"],
      where: { publishedAt: { gte: since }, relevance: { gte: 60 }, dismissed: false },
      _count: true,
    }),
    db.accountPlanItem.findMany({
      where: { kind: "action", status: { not: "done" }, dueDate: { lt: now } },
      include: { account: { select: { name: true } } },
      take: 50,
    }),
  ]);
  const sigMap = new Map(sig.map((s) => [s.accountId, s._count]));
  return json({
    items: nextBestActions(
      {
        now,
        opps: opps.map((o) => ({ ...o, closeDate: new Date(o.closeDate), riskFlags: o.riskFlags })),
        accounts: accounts.map((a) => ({ ...a, highSignals7d: sigMap.get(a.id) ?? 0 })),
        overduePlanActions: plan.map((p) => ({
          id: p.id,
          accountId: p.accountId,
          accountName: p.account.name,
          text: p.text,
          dueDate: p.dueDate!,
        })),
      },
      15,
    ),
  });
});
