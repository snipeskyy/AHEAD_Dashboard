import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({ read: z.boolean() });

export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { read } = Body.parse(await readJson(req));
  return json(await db.notification.update({ where: { id }, data: { read } }));
});
