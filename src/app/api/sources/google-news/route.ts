import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({
  enabled: z.boolean(),
  /** Omit for every real account. */
  accountIds: z.array(z.string().max(60)).max(5000).optional(),
});

/** Bulk opt-in / opt-out of Google News search (an unofficial feed, so it is per-account opt-in). */
export const POST = handler(async (req: Request) => {
  const { enabled, accountIds } = Body.parse(await readJson(req));
  const accounts = await db.account.findMany({
    where: { isDemo: false, ...(accountIds ? { id: { in: accountIds } } : {}) },
    select: { id: true, sourceConfig: true },
  });
  for (const a of accounts)
    await db.account.update({
      where: { id: a.id },
      data: { sourceConfig: { ...((a.sourceConfig ?? {}) as object), googleNews: enabled } },
    });
  await logActivity({
    entityType: "workspace",
    entityId: "sources",
    action: "sources.google-news",
    summary: `Google News ${enabled ? "turned on" : "turned off"} for ${accounts.length} accounts`,
  });
  return json({ updated: accounts.length });
});
