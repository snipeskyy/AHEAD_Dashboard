import { createHash } from "node:crypto";

const TRACKING = /^(utm_|fbclid|gclid|mc_cid|mc_eid|oc$|ref$|cmpid)/i;

/** Normalizes URLs so the same article from different links dedupes: lowercase host, no tracking params / fragment / trailing slash. */
export function normalizeUrl(input: string | null | undefined): string {
  if (!input) return "";
  try {
    const u = new URL(input.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    if (u.pathname.length > 1 && u.pathname.endsWith("/"))
      u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return input.trim().toLowerCase();
  }
}

export const normalizeTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Dedupe hash = sha1(normalized URL + normalized title), scoped to the account. */
export function dedupeHash(
  accountId: string,
  url: string | null,
  title: string,
  key?: string,
): string {
  const basis = key ?? `${normalizeUrl(url)}|${normalizeTitle(title)}`;
  return createHash("sha1").update(`${accountId}|${basis}`).digest("hex");
}
