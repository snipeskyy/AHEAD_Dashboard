/** GLEIF LEI API (free, no key). Pure parsers + small fetch helpers shared by the enricher and identity search. */
import { z } from "zod";
import type { EnrichContext } from "./types";

const DAY = 86_400_000;
const API = "https://api.gleif.org/api/v1";
export const gleifPage = (lei: string) => `https://search.gleif.org/#/record/${lei}`;

const Addr = z
  .object({
    addressLines: z.array(z.string()).default([]),
    city: z.string().nullish(),
    region: z.string().nullish(),
    country: z.string().nullish(),
    postalCode: z.string().nullish(),
  })
  .partial();
export const LeiRecord = z.object({
  id: z.string(),
  attributes: z.object({
    lei: z.string(),
    entity: z.object({
      legalName: z.object({ name: z.string() }),
      legalAddress: Addr.nullish(),
      headquartersAddress: Addr.nullish(),
      jurisdiction: z.string().nullish(),
      status: z.string().nullish(),
    }),
    registration: z.object({ status: z.string().nullish() }).partial().optional(),
  }),
});
export type LeiRecord = z.infer<typeof LeiRecord>;
const One = z.object({ data: LeiRecord });
const Many = z.object({ data: z.array(LeiRecord), meta: z.unknown().optional() });

export function summarize(r: LeiRecord) {
  const e = r.attributes.entity;
  const hq = e.headquartersAddress ?? e.legalAddress ?? null;
  return {
    lei: r.attributes.lei,
    legalName: e.legalName.name,
    city: hq?.city ?? null,
    region: hq?.region ?? null,
    country: hq?.country ?? null,
    jurisdiction: e.jurisdiction ?? null,
    active: (e.status ?? "ACTIVE") === "ACTIVE",
    hq,
  };
}

export async function getRecord(ctx: Pick<EnrichContext, "http">, lei: string) {
  return One.parse(await ctx.http.json(`${API}/lei-records/${lei}`, { ttlMs: 7 * DAY })).data;
}

/** Exact legal-name search first, then full-text; active entities only. */
export async function searchByName(ctx: Pick<EnrichContext, "http">, name: string, size = 5) {
  const q = encodeURIComponent(name);
  const exact = Many.parse(
    await ctx.http.json(`${API}/lei-records?filter[entity.legalName]=${q}&page[size]=${size}`, {
      ttlMs: 7 * DAY,
    }),
  ).data;
  if (exact.length) return exact;
  return Many.parse(
    await ctx.http.json(
      `${API}/lei-records?filter[fulltext]=${q}&filter[entity.status]=ACTIVE&page[size]=${size}`,
      { ttlMs: 7 * DAY },
    ),
  ).data;
}

/** Parent / ultimate parent (404 = none reported) and direct children (first 100). */
export async function hierarchy(ctx: Pick<EnrichContext, "http">, lei: string) {
  const get = async (rel: string) => {
    try {
      return One.parse(await ctx.http.json(`${API}/lei-records/${lei}/${rel}`, { ttlMs: 7 * DAY }))
        .data;
    } catch {
      return null;
    }
  };
  const [parent, ultimate] = [await get("direct-parent"), await get("ultimate-parent")];
  let children: LeiRecord[] = [];
  try {
    children = Many.parse(
      await ctx.http.json(`${API}/lei-records/${lei}/direct-children?page[size]=100`, {
        ttlMs: 7 * DAY,
      }),
    ).data;
  } catch {
    /* none */
  }
  return { parent, ultimate, children };
}
