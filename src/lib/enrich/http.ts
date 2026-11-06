import type { PrismaClient } from "@prisma/client";
import { fetchJson, fetchText, HttpError } from "@/lib/adapters/http";
import { isAllowedByRobots } from "./robots";
import type { EnrichContext, HttpPage } from "./types";

const DAY = 86_400_000;

/** Per-host politeness (ms between requests). SEC asks for ≤ 10 req/s; Wikimedia and GLEIF ask for restraint. */
const HOST_GAP: Record<string, number> = {
  "data.sec.gov": 150,
  "www.sec.gov": 150,
  "api.gleif.org": 1000,
  "www.wikidata.org": 1500,
  "en.wikipedia.org": 1000,
  "dns.google": 250,
  "www.peeringdb.com": 3000,
  "api.usaspending.gov": 1000,
};
const gapFor = (url: string) => HOST_GAP[new URL(url).host] ?? 1000;

/**
 * Descriptive User-Agent with contact info (Wikimedia and SEC require one). Set ENRICH_USER_AGENT in
 * .env.local; falls back to SEC_USER_AGENT, then a generic name. Never hardcoded with a real address.
 */
export function enrichUserAgent() {
  const ua = process.env.ENRICH_USER_AGENT?.trim() || process.env.SEC_USER_AGENT?.trim();
  return ua || "AccountCommandCenter/1.0 (local research tool)";
}

export function createEnrichHttp(
  db: PrismaClient,
  userAgent: string,
  signal: AbortSignal,
): EnrichContext["http"] {
  const robotsCache = new Map<string, string>();

  async function robotsFor(origin: string) {
    if (robotsCache.has(origin)) return robotsCache.get(origin)!;
    let txt = "";
    try {
      txt = (
        await fetchText(`${origin}/robots.txt`, {
          db,
          ttlMs: DAY,
          signal,
          retries: 1,
          headers: { "user-agent": userAgent },
          maxBytes: 200_000,
        })
      ).body;
    } catch (e) {
      // 4xx (no robots.txt) means everything is allowed; anything else: stay conservative and skip.
      if (!(e instanceof HttpError && e.status >= 400 && e.status < 500))
        txt = "User-agent: *\nDisallow: /";
    }
    robotsCache.set(origin, txt);
    return txt;
  }

  return {
    json: (url, o = {}) =>
      fetchJson(url, {
        db,
        signal,
        ttlMs: o.ttlMs ?? DAY,
        minIntervalMs: o.minIntervalMs ?? gapFor(url),
        method: o.method,
        body: o.body,
        headers: {
          "user-agent": userAgent,
          ...(o.body ? { "content-type": "application/json" } : {}),
          ...o.headers,
        },
      }),
    text: async (url, o = {}) =>
      (
        await fetchText(url, {
          db,
          signal,
          ttlMs: o.ttlMs ?? DAY,
          minIntervalMs: o.minIntervalMs ?? gapFor(url),
          noStore: o.noStore,
          maxBytes: o.maxBytes,
          headers: { "user-agent": userAgent, ...o.headers },
        })
      ).body,
    async page(url, o = {}) {
      const u = new URL(url);
      if (!isAllowedByRobots(await robotsFor(u.origin), u.pathname + u.search)) return null;
      // Capture status + headers alongside the body so header-based tech detection works from cache too.
      const wrap: typeof fetch = async (input, init) => {
        const res = await fetch(input, init);
        const body = await res.text();
        const env: HttpPage = {
          status: res.status,
          url: res.url || url,
          headers: Object.fromEntries(
            [...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]),
          ),
          body: body.slice(0, 2_000_000),
        };
        const keep: Record<string, string> = {};
        for (const h of ["etag", "retry-after"])
          if (res.headers.get(h)) keep[h] = res.headers.get(h)!;
        return new Response(res.status === 304 ? null : JSON.stringify(env), {
          status: res.status,
          statusText: res.statusText,
          headers: keep,
        });
      };
      try {
        const { body } = await fetchText(url, {
          db,
          signal,
          ttlMs: o.ttlMs ?? 7 * DAY,
          retries: 1,
          minIntervalMs: 2000,
          fetchImpl: wrap,
          headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
        });
        return JSON.parse(body) as HttpPage;
      } catch (e) {
        if (e instanceof HttpError && e.status >= 400 && e.status < 500) return null;
        throw e;
      }
    },
  };
}
