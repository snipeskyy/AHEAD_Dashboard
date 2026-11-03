import { z } from "zod";
import { classifySignalType } from "../classify";
import { fetchJson } from "../http";
import type { DataAdapter, NormalizedSignal } from "../types";

export const GdeltSchema = z.object({
  articles: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        seendate: z.string(),
        domain: z.string().optional(),
        language: z.string().optional(),
        sourcecountry: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});
export type GdeltRaw = z.infer<typeof GdeltSchema>;

/** GDELT seendate "20261102T121500Z" → Date. */
export function parseGdeltDate(s: string): Date | null {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

export const gdeltAdapter: DataAdapter<NormalizedSignal, GdeltRaw> = {
  id: "gdelt",
  label: "GDELT",
  kind: "public",
  description: "Broader global news coverage (optional; strict 1 request / 5 s limit).",
  rawSchema: GdeltSchema,
  eligible: (a) => !a.isDemo,
  async fetch(ctx) {
    const out: NormalizedSignal[] = [];
    for (const account of ctx.accounts.filter(this.eligible!)) {
      const q = encodeURIComponent(`"${account.name}"`);
      const raw = GdeltSchema.parse(
        await fetchJson(
          `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=20&timespan=3d&sourcelang=english`,
          { db: ctx.db, ttlMs: 60 * 60_000, minIntervalMs: 5500, retries: 2, signal: ctx.signal },
        ),
      );
      out.push(...this.normalize(raw, { account, now: ctx.now }));
    }
    return out;
  },
  normalize(raw, { account, now }) {
    return raw.articles.map((a) => ({
      accountId: account.id,
      type: classifySignalType(a.title),
      title: a.title,
      summary: a.domain
        ? `Reported by ${a.domain}${a.sourcecountry ? ` (${a.sourcecountry})` : ""}.`
        : null,
      url: a.url,
      source: "gdelt",
      publishedAt: parseGdeltDate(a.seendate) ?? now,
    }));
  },
};
