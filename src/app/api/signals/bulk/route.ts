import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({
  ids: z.array(z.string()).min(1).max(500),
  patch: z.object({ read: z.boolean(), dismissed: z.boolean(), starred: z.boolean() }).partial(),
});

export const POST = handler(async (req: Request) => {
  const { ids, patch } = Body.parse(await readJson(req));
  const r = await db.signal.updateMany({ where: { id: { in: ids } }, data: patch });
  return json({ updated: r.count });
});
