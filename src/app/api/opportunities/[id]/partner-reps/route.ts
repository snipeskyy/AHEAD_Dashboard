import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ repId: z.string(), on: z.boolean() });

/** Put a partner rep on (or take them off) a deal. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const opportunityId = (await ctx.params).id;
  const { repId, on } = Body.parse(await readJson(req));
  if (on) await db.opportunityPartnerRep.upsert({ where: { opportunityId_repId: { opportunityId, repId } }, create: { opportunityId, repId }, update: {} });
  else await db.opportunityPartnerRep.deleteMany({ where: { opportunityId, repId } });
  return json({ ok: true });
});
