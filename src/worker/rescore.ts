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

/** Re-applies the current tagging rules + relevance config to recent signals (after rules are edited). */
export async function retagSignals(db: PrismaClient, now: Date, days = 180): Promise<number> {
  const { tagText, toTagIndex } = await import("../lib/tagging/rules");
  const { computeRelevance } = await import("../lib/scoring/relevance");
  const [rules, cfg] = await Promise.all([
    readSetting(db, "tagging.rules"),
    readSetting(db, "scoring.relevance"),
  ]);
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await db.signal.findMany({
    where: { publishedAt: { gte: since } },
    select: {
      id: true,
      title: true,
      summary: true,
      source: true,
      publishedAt: true,
      tagIndex: true,
      relevance: true,
      account: { select: { tier: true } },
    },
  });
  const updates = [];
  for (const r of rows) {
    const tags = tagText(`${r.title} ${r.summary ?? ""}`, rules);
    const rel = computeRelevance(
      {
        publishedAt: r.publishedAt,
        source: r.source,
        keywordHits: tags.hits.length,
        tier: r.account.tier,
        now,
      },
      cfg,
    );
    const idx = toTagIndex(tags.tags);
    if (idx !== r.tagIndex || Math.abs(rel.value - r.relevance) >= 0.1) {
      updates.push(
        db.signal.update({
          where: { id: r.id },
          data: {
            practiceTags: tags.tags,
            tagIndex: idx,
            relevance: rel.value,
            relevanceParts: { ...rel.parts },
          },
        }),
      );
    }
  }
  for (let i = 0; i < updates.length; i += 500) await db.$transaction(updates.slice(i, i + 500));
  return updates.length;
}
