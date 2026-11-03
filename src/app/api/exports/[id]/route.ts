import { deleteExport } from "@/lib/server/exports";
import { handler, json } from "@/lib/server/http";

export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await deleteExport((await ctx.params).id);
  return json({ ok: true });
});
