import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

/** Compact stage-change events for client-side conversion/velocity analytics. */
export const GET = handler(async () => {
  const rows = await db.stageChange.findMany({
    select: { opportunityId: true, fromStage: true, toStage: true, changedAt: true },
    orderBy: { changedAt: "asc" },
  });
  return json({ items: rows.map((r) => ({ ...r, changedAt: r.changedAt.toISOString() })) });
});
