import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await db.techStackHypothesis.delete({ where: { id: (await ctx.params).id } });
  return json({ ok: true });
});
