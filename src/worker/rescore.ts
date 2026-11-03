import type { PrismaClient } from "@prisma/client";
import { rescoreFromParts } from "../lib/scoring/relevance";
import { readSetting } from "../lib/settings/store";

/** Re-applies recency decay to signals from the last 60 days (older ones are already ~0). */
export async function rescoreSignals(db: PrismaClient, now: Date): Promise<number> {
  const cfg = await readSetting(db, "scoring.relevance");
  const since = new Date(now.getTime() - 60 * 86_400_000);
  const rows = await db.signal.findMany({
    where: { publishedAt: { gte: since } },
    select: { id: true, publishedAt: true, relevanceParts: true, relevance: true },
  });
  const updates = [];
  for (const r of rows) {
    const p = r.relevanceParts as {
      sourceWeight: number;
      practiceMatch: number;
      tierFactor: number;
    };
    const { recency, value } = rescoreFromParts(p, r.publishedAt, now, cfg.halfLifeDays);
    if (Math.abs(value - r.relevance) >= 0.1) {
      updates.push(
        db.signal.update({
          where: { id: r.id },
          data: { relevance: value, relevanceParts: { ...p, recency } },
        }),
      );
    }
  }
  for (let i = 0; i < updates.length; i += 500) await db.$transaction(updates.slice(i, i + 500));
  return updates.length;
}
