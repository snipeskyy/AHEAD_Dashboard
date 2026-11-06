import { enrichmentOverview } from "@/lib/server/enrichment";
import { handler, json } from "@/lib/server/http";

/** Status + completeness per real account (Accounts table columns, "Stale data" filter, Fix-it hints). */
export const GET = handler(async () => {
  const items = await enrichmentOverview();
  return json({
    items: items.map(({ missing, ...r }) => ({
      ...r,
      topMissing: missing.slice(0, 3).map((m) => m.label),
    })),
  });
});
