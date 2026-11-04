/**
 * `npm run test:db:seed`: writes the synthetic fixture dataset to the TEST database only.
 * Refuses to run unless invoked through scripts/with-test-db.mjs (ACC_TEST_DB=1), so the app's
 * real database can never receive demo data.
 */
import { PrismaClient } from "@prisma/client";
import { runSeed } from "./index";
import { wipeAllTables } from "./wipe";

const url = process.env.DATABASE_URL ?? "";
if (process.env.ACC_TEST_DB !== "1" || /(^|[/:])dev\.db$/.test(url)) {
  console.error(
    "[seed] Refusing to seed: fixtures may only be written to the test database.\n" +
      "       Use `npm run test:db:seed` (runs via scripts/with-test-db.mjs).",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
wipeAllTables(prisma) // every run starts from exactly the fixture dataset
  .then(() => runSeed(prisma))
  .then((msg) => console.log(msg))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
