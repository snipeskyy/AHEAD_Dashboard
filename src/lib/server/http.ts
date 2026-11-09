import "server-only";
import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const json = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
  }
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unexpected error" },
    { status: 500 },
  );
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const GZIP_MIN_BYTES = 16 * 1024;

/**
 * Route handler JSON isn't compressed by `next start`, so large payloads (e.g. 2,000 opportunities ≈ 1.3 MB)
 * are gzipped here when the client accepts it (~8× smaller over a LAN). Streams and downloads pass through.
 */
async function maybeCompress(req: unknown, res: Response): Promise<Response> {
  if (!(req instanceof Request) || !/\bgzip\b/.test(req.headers.get("accept-encoding") ?? "")) return res;
  if (res.headers.get("content-encoding") || res.headers.get("content-disposition")) return res;
  if (!(res.headers.get("content-type") ?? "").includes("application/json") || !res.body) return res;
  const buf = Buffer.from(await res.arrayBuffer());
  const headers = new Headers(res.headers);
  if (buf.byteLength < GZIP_MIN_BYTES) return new Response(buf, { status: res.status, headers });
  headers.set("content-encoding", "gzip");
  headers.set("vary", "accept-encoding");
  headers.delete("content-length");
  return new Response(gzipSync(buf, { level: 5 }), { status: res.status, headers });
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Phase 15: every write must come from ACC's own pages (or a non-browser client such as the token-protected staging
 * API, which sends no Origin). A browser request from another site is refused, so a malicious page can't change
 * your data through your browser (CSRF).
 */
export function assertSameOriginWrite(req: unknown) {
  if (!(req instanceof Request) || SAFE_METHODS.has(req.method)) return;
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Cross-origin request refused");
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") {
    if (origin === "null") throw new HttpError(403, "Cross-origin request refused");
    return;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-origin request refused");
  }
  if (!host || originHost !== host) throw new HttpError(403, "Cross-origin request refused");
}

/** Wraps a route handler with consistent error handling, the same-origin write check, and gzip for large JSON. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      assertSameOriginWrite(args[0]);
      return await maybeCompress(args[0], await fn(...args));
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
}
