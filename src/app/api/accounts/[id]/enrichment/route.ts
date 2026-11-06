import { z } from "zod";
import { db } from "@/lib/db";
import { enqueueEnrichment } from "@/lib/enrich/runner";
import { accountEnrichment } from "@/lib/server/enrichment";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) =>
  json(await accountEnrichment((await ctx.params).id)),
);

/** "Fetch public data" for one account: queue it (force = ignore TTL). */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const b = z
    .object({ force: z.boolean().default(true), enricherIds: z.array(z.string()).optional() })
    .parse(await readJson(req).catch(() => ({})));
  return json(await enqueueEnrichment(db, [(await ctx.params).id], b), { status: 202 });
});
