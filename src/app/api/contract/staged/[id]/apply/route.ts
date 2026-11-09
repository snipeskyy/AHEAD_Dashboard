import { handler, json } from "@/lib/server/http";
import { applyStaged } from "@/lib/server/contract/staging";

/** Apply a reviewed file (one undoable group in Import → History). */
export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  json(await applyStaged((await ctx.params).id)),
);
