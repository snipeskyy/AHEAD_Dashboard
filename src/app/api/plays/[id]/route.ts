import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";
import { PlayBody, toPlayDTO } from "@/lib/server/plays";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  return json(
    toPlayDTO(
      await db.play.update({ where: { id }, data: PlayBody.partial().parse(await readJson(req)) }),
    ),
  );
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await db.campaign.updateMany({ where: { playId: id }, data: { playId: null } });
  await db.play.delete({ where: { id } });
  return json({ ok: true });
});
