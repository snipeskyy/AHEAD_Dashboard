/** `npm run db:backup`: writes backups/manual-<timestamp>.json. */
import { PrismaClient } from "@prisma/client";
import { writeBackupFile } from "../src/lib/backup/snapshot";

const db = new PrismaClient();
writeBackupFile(db, "manual")
  .then((f) => console.log(`[acc] Backup written: ${f}`))
  .finally(() => db.$disconnect());
