import { db } from "@/lib/db";
import { loadScoreInputs } from "@/lib/scoring/account-scores";
import { computeHealth } from "@/lib/scoring/health";
import { getSetting } from "@/lib/settings/server";
import { handler, json } from "@/lib/server/http";

/** Accounts × health dimensions (sub-scores 0..1) for the heatmap widget. */
export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const tier = sp.get("tier") ?? undefined;
  // The widget shows the lowest-health accounts first; 60 rows is more than any widget height fits.
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 60, 1), 500);
  const now = new Date();
  const accounts = await db.account.findMany({
    where: { tier },
    select: { id: true, name: true, tier: true, healthScore: true },
    orderBy: { healthScore: "asc" },
    take: limit,
  });
  const [inputs, weights] = await Promise.all([
    loadScoreInputs(
      db,
      accounts.map((a) => a.id),
      now,
    ),
    getSetting("scoring.health"),
  ]);
  const byId = new Map(inputs.map((i) => [i.accountId, i]));
  const rows = accounts.map((a) => {
    const h = computeHealth(byId.get(a.id)!.health, weights);
    return {
      id: a.id,
      name: a.name,
      tier: a.tier,
      health: h.value,
      dims: h.components.map((c) => ({ id: c.id, label: c.label, score: c.score, input: c.input })),
    };
  });
  return json({ dimensions: rows[0]?.dims.map((d) => ({ id: d.id, label: d.label })) ?? [], rows });
});
