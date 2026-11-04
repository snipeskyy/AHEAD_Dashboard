/**
 * `npm run db:reset`: wipes the database and re-applies migrations, after a backup and a typed
 * confirmation. The app never seeds; an empty database opens on the onboarding flow.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { writeBackupFile } from "../src/lib/backup/snapshot";
import { confirm } from "./lib/confirm";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const dbFile = url.startsWith("file:") ? `prisma/${url.slice(5).replace(/^\.\//, "")}` : null;
  if (dbFile && existsSync(dbFile)) {
    const db = new PrismaClient();
    try {
      const n = await db.account.count();
      const file = await writeBackupFile(db, "pre-reset");
      console.log(`[acc] ${n} accounts. Backup written: ${file}`);
    } catch {
      console.log("[acc] Could not back up (schema may be out of date); continuing to confirm.");
    } finally {
      await db.$disconnect();
    }
  }
  if (!(await confirm(`This permanently deletes ALL data in ${url || "the database"}.`, "reset"))) {
    console.log("[acc] Cancelled. Nothing was deleted.");
    return;
  }
  const r = spawnSync("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(r.status ?? 1);
}
main();
