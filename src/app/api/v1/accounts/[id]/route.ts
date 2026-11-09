import { handler, json } from "@/lib/server/http";
import { v1Account } from "@/lib/server/local-api";

/** Local read-only API: one account with its contacts, opportunities, activities, notes, tasks and partner reps. */
export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  json(await v1Account(req, (await ctx.params).id)),
);
