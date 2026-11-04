import { classifySignalType } from "../classify";
import { fetchText } from "../http";
import { parseFeed, type FeedItem } from "../rss";
import type { AdapterAccount, DataAdapter, NormalizedSignal } from "../types";

const MAX_AGE_DAYS = 30;

/** Google News titles end with " - Publisher"; split it off. */
export function splitPublisher(title: string): { title: string; publisher: string | null } {
  const m = title.match(/^(.*\S)\s+-\s+([^-]{2,80})$/);
  return m ? { title: m[1], publisher: m[2].trim() } : { title, publisher: null };
}

export const googleNewsUrl = (a: AdapterAccount) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`"${a.name.replace(/\b(Inc\.?|Corp\.?|Corporation|LLC|Ltd\.?|plc)$/i, "").trim()}"`)}&hl=en-US&gl=US&ceid=US:en`;

export const googleNewsAdapter: DataAdapter<NormalizedSignal, FeedItem[]> = {
  id: "google-news",
  label: "Google News RSS",
  kind: "public",
  description:
    "News search per account name (unofficial RSS endpoint; rate-limited, cached 30 min).",
  schedule: "every scheduler tick",
  eligible: (a) => !a.isDemo && a.sourceConfig.googleNews === true, // opt-in per account (unofficial feed)
  async fetch(ctx) {
    const out: NormalizedSignal[] = [];
    for (const account of ctx.accounts.filter(this.eligible!)) {
      const { body } = await fetchText(googleNewsUrl(account), {
        db: ctx.db,
        ttlMs: 30 * 60_000,
        minIntervalMs: 2000,
        signal: ctx.signal,
      });
      out.push(...this.normalize(parseFeed(body), { account, now: ctx.now }));
    }
    return out;
  },
  normalize(items, { account, now }) {
    const cutoff = now.getTime() - MAX_AGE_DAYS * 86_400_000;
    return items
      .filter((i) => (i.publishedAt?.getTime() ?? now.getTime()) >= cutoff)
      .slice(0, 25)
      .map((i) => {
        const { title, publisher } = splitPublisher(i.title);
        return {
          accountId: account.id,
          type: classifySignalType(title),
          title,
          summary: publisher ? `Reported by ${publisher}.` : null,
          url: i.link,
          source: "google-news",
          publishedAt: i.publishedAt ?? now,
        };
      });
  },
};
