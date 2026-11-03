import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

export const FeedItemSchema = z.object({
  title: z.string().min(1),
  link: z.string().nullable(),
  publishedAt: z.date().nullable(),
  description: z.string().nullable(),
  sourceName: z.string().nullable(),
});
export type FeedItem = z.infer<typeof FeedItemSchema>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
});

const text = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>))
    return String((v as Record<string, unknown>)["#text"]);
  return null;
};
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function stripHtml(s: string | null): string | null {
  if (!s) return null;
  const out = s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return out || null;
}

const toDate = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Parses RSS 2.0 and Atom into FeedItems (invalid items are dropped). */
export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const out: FeedItem[] = [];
  const rss = doc.rss as { channel?: { item?: unknown } } | undefined;
  if (rss?.channel) {
    for (const it of arr(rss.channel.item as Record<string, unknown> | Record<string, unknown>[])) {
      out.push({
        title: stripHtml(text(it.title)) ?? "",
        link: text(it.link),
        publishedAt: toDate(text(it.pubDate) ?? text(it["dc:date"])),
        description: stripHtml(text(it.description)),
        sourceName: text(it.source),
      });
    }
  }
  const feed = doc.feed as { entry?: unknown } | undefined;
  if (feed) {
    for (const e of arr(feed.entry as Record<string, unknown> | Record<string, unknown>[])) {
      const links = arr(e.link as Record<string, string> | Record<string, string>[]);
      const href = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate")?.["@_href"] ?? null;
      out.push({
        title: stripHtml(text(e.title)) ?? "",
        link: href,
        publishedAt: toDate(text(e.updated) ?? text(e.published)),
        description: stripHtml(text(e.summary) ?? text(e.content)),
        sourceName: null,
      });
    }
  }
  return out.filter((i) => FeedItemSchema.safeParse(i).success);
}
