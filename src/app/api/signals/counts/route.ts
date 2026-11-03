import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

/** New high-relevance signal counts for the KPI strip. */
export const GET = handler(async () => {
  const now = Date.now();
  const [h24, d7] = await Promise.all([
    db.signal.count({
      where: {
        publishedAt: { gte: new Date(now - 86_400_000) },
        relevance: { gte: 60 },
        dismissed: false,
      },
    }),
    db.signal.count({
      where: {
        publishedAt: { gte: new Date(now - 7 * 86_400_000) },
        relevance: { gte: 60 },
        dismissed: false,
      },
    }),
  ]);
  return json({ h24, d7 });
});
