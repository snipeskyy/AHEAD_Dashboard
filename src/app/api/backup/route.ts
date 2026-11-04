import { snapshotAll } from "@/lib/backup/snapshot";
import { db } from "@/lib/db";
import { handler } from "@/lib/server/http";

/** Full JSON backup of every table (local data only; nothing leaves the machine). */
export const GET = handler(async () => {
  const body = JSON.stringify(await snapshotAll(db));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="acc-backup-${stamp}.json"`,
    },
  });
});
