import { z } from "zod";
import { confirmIdentity, identityCandidates } from "@/lib/server/enrichment";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Candidate entities from SEC, GLEIF and Wikidata for the disambiguation dialog (read-only). */
export const GET = handler(async (_req: Request, ctx: Ctx) =>
  json(await identityCandidates((await ctx.params).id)),
);

const Ids = z.object({
  cik: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/)
    .nullish(),
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,5}([.-][A-Z]{1,2})?$/)
    .nullish(),
  lei: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{20}$/)
    .nullish(),
  wikidataId: z
    .string()
    .trim()
    .regex(/^Q\d+$/)
    .nullish(),
  domain: z.string().trim().toLowerCase().max(253).nullish(),
  legalName: z.string().trim().max(200).nullish(),
});

/** Confirm or override identifiers (locked against enrichment), then re-enrich. */
export const POST = handler(async (req: Request, ctx: Ctx) =>
  json(await confirmIdentity((await ctx.params).id, Ids.parse(await readJson(req)))),
);
