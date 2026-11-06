import type { PrismaClient } from "@prisma/client";

/**
 * Polite HTTP for public sources:
 *  - per-host minimum interval (rate limit), e.g. GDELT 1 req / 5s, SEC ≤ 10 req/s
 *  - response cache in the HttpCache table with TTL (and ETag revalidation)
 *  - retries with exponential backoff on 429 / 5xx / network errors
 *  - hard timeout per request
 */
export interface HttpOptions {
  db: PrismaClient;
  ttlMs: number;
  headers?: Record<string, string>;
  minIntervalMs?: number;
  retries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  method?: "GET" | "POST";
  body?: string;
  /** Don't write the response to HttpCache (large documents such as 10-K filings). */
  noStore?: boolean;
  /** Truncate bodies larger than this (bytes of text). */
  maxBytes?: number;
  /** For tests: injectable fetch + sleep. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const DEFAULT_USER_AGENT = "AccountCommandCenter/0.1 (local research tool)";
const lastHit = new Map<string, number>();
const realSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function backoffDelay(attempt: number, base = 1000, retryAfterSec?: number | null) {
  if (retryAfterSec && retryAfterSec > 0) return Math.min(60_000, retryAfterSec * 1000);
  return Math.min(30_000, base * 2 ** attempt) + Math.floor(Math.random() * 250);
}

export async function fetchText(
  url: string,
  opts: HttpOptions,
): Promise<{ body: string; cached: boolean }> {
  const sleep = opts.sleep ?? realSleep;
  const f = opts.fetchImpl ?? fetch;
  const key = opts.method === "POST" ? `POST ${url} ${opts.body ?? ""}` : url;
  const cached = opts.noStore ? null : await opts.db.httpCache.findUnique({ where: { key } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < opts.ttlMs)
    return { body: cached.body, cached: true };

  const host = new URL(url).host;
  const retries = opts.retries ?? 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Per-host rate limit.
    const minGap = opts.minIntervalMs ?? 1000;
    const wait = (lastHit.get(host) ?? 0) + minGap - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    try {
      const res = await f(url, {
        method: opts.method ?? "GET",
        body: opts.body,
        headers: {
          "user-agent": DEFAULT_USER_AGENT,
          accept: "*/*",
          ...(cached?.etag ? { "if-none-match": cached.etag } : {}),
          ...opts.headers,
        },
        signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 20_000),
        redirect: "follow",
      });
      if (res.status === 304 && cached) {
        await opts.db.httpCache.update({ where: { key }, data: { fetchedAt: new Date() } });
        return { body: cached.body, cached: true };
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(res.status, `${res.status} from ${host}`);
        if (attempt < retries) {
          await sleep(backoffDelay(attempt, 1000, Number(res.headers.get("retry-after")) || null));
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText} from ${host}`);
      let body = await res.text();
      if (opts.maxBytes && body.length > opts.maxBytes) body = body.slice(0, opts.maxBytes);
      const etag = res.headers.get("etag");
      if (opts.noStore) return { body, cached: false };
      await opts.db.httpCache.upsert({
        where: { key },
        create: { key, body, etag, fetchedAt: new Date() },
        update: { body, etag, fetchedAt: new Date() },
      });
      return { body, cached: false };
    } catch (e) {
      if (e instanceof HttpError && e.status !== 429 && e.status < 500) throw e;
      lastErr = e;
      if (attempt < retries) await sleep(backoffDelay(attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchJson<T = unknown>(url: string, opts: HttpOptions): Promise<T> {
  const { body } = await fetchText(url, {
    ...opts,
    headers: { accept: "application/json", ...opts.headers },
  });
  return JSON.parse(body) as T;
}

/** Test helper: reset the per-host limiter. */
export function __resetRateLimiter() {
  lastHit.clear();
}
