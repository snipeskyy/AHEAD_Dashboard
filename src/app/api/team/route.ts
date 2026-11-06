import { z } from "zod";
import { ensureLocalUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

export const PATCH = handler(async (req: Request) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(await readJson(req));
  const me = await ensureLocalUser();
  return json({ team: await db.team.update({ where: { id: me.teamId }, data: { name } }) });
});
