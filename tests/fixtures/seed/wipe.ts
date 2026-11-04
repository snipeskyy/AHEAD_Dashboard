import type { PrismaClient } from "@prisma/client";
import { createSqliteSearchProvider } from "../../../src/lib/search/sqlite-provider";

/**
 * TEST DB ONLY: empties every table in place (the file and any open server connection stay valid).
 * Callers must already have checked they are on the test database.
 */
export async function wipeAllTables(db: PrismaClient) {
  const tables = await db.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' AND name NOT LIKE 'search_index%'`,
  );
  await createSqliteSearchProvider(db).drop(); // FTS table + triggers; runSeed rebuilds them
  await db.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
  for (const t of tables) await db.$executeRawUnsafe(`DELETE FROM "${t.name}"`);
  await db.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
}
