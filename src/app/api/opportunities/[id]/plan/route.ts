import { z } from "zod";
import { handler, json, readJson } from "@/lib/server/http";
import { createPlan, deletePlan, getPlan, updatePlan } from "@/lib/server/action-plans";

type Ctx = { params: Promise<{ id: string }> };

/** The opportunity's mutual action plan (null when there is none yet). */
export const GET = handler(async (_req: Request, ctx: Ctx) =>
  json({ plan: await getPlan((await ctx.params).id) }),
);

/** Start a plan, empty or from the generic starter path. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const b = z.object({ starter: z.boolean().default(true) }).parse(await readJson(req));
  return json({ plan: await createPlan((await ctx.params).id, b) });
});

export const PATCH = handler(async (req: Request, ctx: Ctx) =>
  json({ plan: await updatePlan((await ctx.params).id, await readJson(req)) }),
);

export const DELETE = handler(async (_req: Request, ctx: Ctx) =>
  json(await deletePlan((await ctx.params).id)),
);
