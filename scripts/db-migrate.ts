/**
 * `npm run db:migrate -- --name <change>` — wraps `prisma migrate dev`.
 * The FTS5 search index is runtime-managed (not in Prisma's schema), so we drop it first to avoid
 * Prisma reporting drift, then let the app/worker recreate it lazily on next start.
 */
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createSqliteSearchProvider } from "../src/lib/search/sqlite-provider";

async function main() {
  const db = new PrismaClient();
  await createSqliteSearchProvider(db).drop();
  await db.$disconnect();
  const r = spawnSync("npx", ["prisma", "migrate", "dev", ...process.argv.slice(2)], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const db2 = new PrismaClient();
  await createSqliteSearchProvider(db2).ensureReady();
  await db2.$disconnect();
}
main();
