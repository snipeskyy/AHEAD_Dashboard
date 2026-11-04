import { handler, json } from "@/lib/server/http";
import { undoImpact } from "@/lib/server/import/undo";

/** Batch detail plus what undoing it would remove. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { batch, ...impact } = await undoImpact((await ctx.params).id);
  const { records: _r, ...rest } = batch;
  return json({ batch: rest, ...impact });
});
