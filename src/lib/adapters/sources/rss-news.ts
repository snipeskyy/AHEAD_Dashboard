import { classifySignalType } from "../classify";
import { fetchText } from "../http";
import { parseFeed, type FeedItem } from "../rss";
import type { DataAdapter, NormalizedSignal } from "../types";

/** User-added feeds per account (company newsroom, trade press). */
export const rssNewsAdapter: DataAdapter<NormalizedSignal, FeedItem[]> = {
  id: "rss-news",
  label: "Custom RSS feeds",
  kind: "public",
  description: "Company newsrooms and trade-press feeds you add per account.",
  eligible: (a) => (a.sourceConfig.rssFeeds?.length ?? 0) > 0,
  async fetch(ctx) {
    const out: NormalizedSignal[] = [];
    for (const account of ctx.accounts.filter(this.eligible!)) {
      for (const feed of account.sourceConfig.rssFeeds ?? []) {
        try {
          const { body } = await fetchText(feed, {
            db: ctx.db,
            ttlMs: 30 * 60_000,
            minIntervalMs: 1000,
            signal: ctx.signal,
          });
          out.push(...this.normalize(parseFeed(body), { account, now: ctx.now }));
        } catch (e) {
          ctx.log(`rss-news: ${feed} failed: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    return out;
  },
  normalize(items, { account, now }) {
    const cutoff = now.getTime() - 60 * 86_400_000;
    return items
      .filter((i) => (i.publishedAt?.getTime() ?? now.getTime()) >= cutoff)
      .slice(0, 30)
      .map((i) => ({
        accountId: account.id,
        type: classifySignalType(`${i.title} ${i.description ?? ""}`),
        title: i.title,
        summary: i.description ? i.description.slice(0, 400) : null,
        url: i.link,
        source: "rss-news",
        publishedAt: i.publishedAt ?? now,
        tagText: i.description ?? undefined,
      }));
  },
};
