import { TIERS, type Tier } from "@/lib/domain/enums";

export interface ImportRowInput {
  name?: unknown;
  domain?: unknown;
  ticker?: unknown;
  industry?: unknown;
  tier?: unknown;
  greenhouseSlug?: unknown;
  leverSlug?: unknown;
}

export interface NormalizedImportRow {
  name: string;
  domain: string | null;
  ticker: string | null;
  industry: string | null;
  tier: Tier;
  greenhouseSlug: string | null;
  leverSlug: string | null;
}

const str = (v: unknown) =>
  typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim();

/** "https://www.Example.com/about" → "example.com". Returns null for anything that isn't a hostname. */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "");
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s) ? s : null;
}

export function normalizeTicker(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/^\$/, "");
  if (!s) return null;
  return /^[A-Z]{1,5}([.-][A-Z]{1,2})?$/.test(s) ? s : null;
}

const slug = (v: string) => (/^[a-z0-9][a-z0-9-_]{0,79}$/i.test(v) ? v.toLowerCase() : null);

export function normalizeImportRow(
  row: ImportRowInput,
): { ok: true; value: NormalizedImportRow } | { ok: false; error: string } {
  const name = str(row.name).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 160)
    return { ok: false, error: "Name is required (2–160 characters)" };
  const domainRaw = str(row.domain);
  const domain = domainRaw ? normalizeDomain(domainRaw) : null;
  if (domainRaw && !domain) return { ok: false, error: `Invalid domain "${domainRaw}"` };
  const tickerRaw = str(row.ticker);
  const ticker = tickerRaw ? normalizeTicker(tickerRaw) : null;
  if (tickerRaw && !ticker) return { ok: false, error: `Invalid ticker "${tickerRaw}"` };
  const tierRaw = str(row.tier);
  const tier = (TIERS.find((t) => t.toLowerCase() === tierRaw.toLowerCase()) ?? "Growth") as Tier;
  const industry = str(row.industry) || null;
  return {
    ok: true,
    value: {
      name,
      domain,
      ticker,
      industry: industry ? industry.slice(0, 80) : null,
      tier,
      greenhouseSlug: slug(str(row.greenhouseSlug)),
      leverSlug: slug(str(row.leverSlug)),
    },
  };
}
