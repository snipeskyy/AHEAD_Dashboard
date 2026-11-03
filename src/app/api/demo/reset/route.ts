import { runSeed } from "../../../../../prisma/seed";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { handler, json } from "@/lib/server/http";

/** Settings → "Reset demo data". Only touches isDemo rows; user-added accounts are preserved. */
export const POST = handler(async () => {
  const message = await runSeed(db);
  await logActivity({
    entityType: "workspace",
    entityId: "demo",
    action: "demo.reset",
    summary: "Demo data reset",
  });
  return json({ ok: true, message });
});
