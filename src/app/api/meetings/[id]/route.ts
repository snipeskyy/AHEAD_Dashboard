import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

/** Link (or unlink) a meeting to an account when attendee domains didn't match. */
export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { accountId } = z.object({ accountId: z.string().nullable() }).parse(await readJson(req));
  return json(await db.meeting.update({ where: { id: (await ctx.params).id }, data: { accountId } }));
});
