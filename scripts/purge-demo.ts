/**
 * `npm run db:purge-demo`: one-time removal of all demo data from YOUR database.
 * 1. writes backups/pre-purge-<timestamp>.json  2. shows counts  3. asks to confirm  4. deletes.
 * Real accounts, your notes on them, layouts and settings are kept. Demo plays become Starter Plays.
 */
import { PrismaClient } from "@prisma/client";
import { writeBackupFile } from "../src/lib/backup/snapshot";
import { countDemo, hasDemo, purgeDemoData } from "../src/lib/data/purge-demo";
import { confirm } from "./lib/confirm";

async function main() {
  const db = new PrismaClient();
  try {
    const counts = await countDemo(db);
    if (!hasDemo(counts)) {
      console.log("[acc] No demo data found. Nothing to do.");
      return;
    }
    console.log("[acc] Demo data found:");
    console.table(counts);
    const file = await writeBackupFile(db, "pre-purge");
    console.log(`[acc] Backup written: ${file}`);
    if (!(await confirm("Delete all demo records listed above?"))) {
      console.log("[acc] Cancelled. Nothing was deleted.");
      return;
    }
    const r = await purgeDemoData(db);
    console.log("[acc] Removed:");
    console.table(r.removed);
    console.log(`[acc] ${r.starterPlays} plays kept as Starter Plays.`);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
