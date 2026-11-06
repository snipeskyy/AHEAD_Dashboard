/**
 * Wikidata (entity JSON + search API) and Wikipedia REST summary. Pure claim parsing + fetch helpers,
 * shared by the enricher and identity search. Wikimedia asks for a descriptive User-Agent with contact.
 */
import type { EnrichContext } from "./types";

const DAY = 86_400_000;
export const wikidataPage = (q: string) => `https://www.wikidata.org/wiki/${q}`;

type Snak = { snaktype?: string; datavalue?: { value: unknown; type?: string } };
export type Claim = { mainsnak: Snak; rank?: string; qualifiers?: Record<string, Snak[]> };
export interface Entity {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, { title: string }>;
}

const pointInTime = (c: Claim) => {
  const t = (c.qualifiers?.P585?.[0]?.datavalue?.value as { time?: string } | undefined)?.time;
  return t ? Date.parse(t.replace(/^\+/, "")) || 0 : 0;
};

/** Preferred-rank claim, else the most recent by "point in time", else the last listed. Deprecated ignored. */
export function bestClaim(e: Entity, p: string): Claim | null {
  const list = (e.claims?.[p] ?? []).filter(
    (c) => c.rank !== "deprecated" && c.mainsnak.snaktype === "value",
  );
  if (!list.length) return null;
  return (
    list.find((c) => c.rank === "preferred") ??
    [...list].sort((a, b) => pointInTime(b) - pointInTime(a))[0]
  );
}

export const claimItem = (c: Claim | null) =>
  (c?.mainsnak.datavalue?.value as { id?: string } | undefined)?.id ?? null;
export const claimString = (c: Claim | null) => {
  const v = c?.mainsnak.datavalue?.value;
  return typeof v === "string" ? v : null;
};
export function claimYear(c: Claim | null) {
  const t = (c?.mainsnak.datavalue?.value as { time?: string } | undefined)?.time;
  const m = t && /^[+-]?(\d{4})/.exec(t);
  return m ? Number(m[1]) : null;
}
/** Quantity; `usdOnly` requires unit Q4917 (US dollar). */
export function claimAmount(c: Claim | null, usdOnly = false) {
  const v = c?.mainsnak.datavalue?.value as { amount?: string; unit?: string } | undefined;
  if (!v?.amount) return null;
  if (usdOnly && !/\/Q4917$/.test(v.unit ?? "")) return null;
  const n = Number(v.amount);
  return Number.isFinite(n) ? n : null;
}
export const itemIds = (e: Entity, p: string, max = 30) =>
  (e.claims?.[p] ?? [])
    .filter((c) => c.rank !== "deprecated")
    .map(claimItem)
    .filter((x): x is string => !!x)
    .slice(0, max);
export const label = (e: Entity) => e.labels?.en?.value ?? e.id;

export async function getEntity(ctx: Pick<EnrichContext, "http">, q: string) {
  const r = await ctx.http.json<{ entities: Record<string, Entity> }>(
    `https://www.wikidata.org/wiki/Special:EntityData/${q}.json`,
    { ttlMs: 7 * DAY },
  );
  return Object.values(r.entities)[0] ?? null;
}

export async function getLabels(ctx: Pick<EnrichContext, "http">, ids: string[]) {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    if (!chunk.length) continue;
    const r = await ctx.http.json<{ entities: Record<string, Entity> }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join("|")}&props=labels&languages=en&format=json`,
      { ttlMs: 30 * DAY },
    );
    for (const e of Object.values(r.entities ?? {})) out.set(e.id, label(e));
  }
  return out;
}

export interface SearchHit {
  id: string;
  label: string;
  description?: string;
}
export async function search(ctx: Pick<EnrichContext, "http">, name: string, limit = 5) {
  const r = await ctx.http.json<{ search?: SearchHit[] }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=${limit}&format=json`,
    { ttlMs: 7 * DAY },
  );
  return r.search ?? [];
}

const ORG_HINT =
  /\b(company|corporation|business|enterprise|conglomerate|manufacturer|bank|insurer|retailer|provider|firm|organization|holding|group|airline|utility|hospital|health system|university)\b/i;
export const looksLikeOrg = (h: SearchHit) => ORG_HINT.test(h.description ?? "");

export async function wikipediaSummary(ctx: Pick<EnrichContext, "http">, title: string) {
  return ctx.http.json<{ extract?: string; content_urls?: { desktop?: { page?: string } } }>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    { ttlMs: 7 * DAY },
  );
}
