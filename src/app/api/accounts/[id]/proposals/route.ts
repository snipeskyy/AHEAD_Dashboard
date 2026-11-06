import { z } from "zod";
import { decideProposals } from "@/lib/server/enrichment";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({
  action: z.enum(["accept", "reject"]),
  ids: z.array(z.string()).max(1000).optional(),
  section: z.string().max(40).optional(),
});

/** Accept / reject proposals: one, a set, a section, or all. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const b = Body.parse(await readJson(req));
  return json(
    await decideProposals((await ctx.params).id, b.action, { ids: b.ids, section: b.section }),
  );
});
