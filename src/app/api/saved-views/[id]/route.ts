import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await db.savedView.delete({ where: { id } });
  return json({ ok: true });
});
