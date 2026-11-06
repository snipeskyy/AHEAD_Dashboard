import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({ action: z.enum(["read", "starred", "dismissed", "play", "opportunity", "note", "task"]) });

/** Marks a signal handled in the triage queue (and applies star/dismiss/read side effects). */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { action } = Body.parse(await readJson(req));
  const s = await db.signal.update({
    where: { id: (await ctx.params).id },
    data: {
      triagedAt: new Date(),
      triageAction: action,
      read: true,
      ...(action === "starred" ? { starred: true } : {}),
      ...(action === "dismissed" ? { dismissed: true } : {}),
    },
    select: { id: true, triagedAt: true, triageAction: true },
  });
  return json(s);
});
