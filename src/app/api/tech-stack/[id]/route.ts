import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await db.techStackHypothesis.delete({ where: { id: (await ctx.params).id } });
  return json({ ok: true });
});

/** Confirm or reject a hypothesis (kept with its evidence either way). */
export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { z } = await import("zod");
  const { readJson } = await import("@/lib/server/http");
  const { status } = z
    .object({ status: z.enum(["hypothesis", "confirmed", "rejected"]) })
    .parse(await readJson(req));
  return json(
    await db.techStackHypothesis.update({ where: { id: (await ctx.params).id }, data: { status } }),
  );
});
