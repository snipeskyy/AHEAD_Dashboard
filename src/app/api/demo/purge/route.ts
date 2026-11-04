import path from "node:path";
import { writeBackupFile } from "@/lib/backup/snapshot";
import { countDemo, hasDemo, purgeDemoData } from "@/lib/data/purge-demo";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { handler, json } from "@/lib/server/http";

/** Settings → Data → "Remove demo data". Always writes backups/pre-purge-<ts>.json first. */
export const POST = handler(async () => {
  if (!hasDemo(await countDemo(db))) return json({ ok: true, removed: null, backup: null });
  const backup = await writeBackupFile(db, "pre-purge");
  const r = await purgeDemoData(db);
  await logActivity({
    entityType: "workspace",
    entityId: "data",
    action: "demo.purged",
    summary: `Removed demo data (${r.removed.accounts} accounts)`,
  });
  return json({ ok: true, ...r, backup: path.relative(process.cwd(), backup) });
});
