#!/usr/bin/env node
/**
 * Runs a command against the TEST database, never the real one.
 *   node scripts/with-test-db.mjs <command> [...args]
 *
 * DATABASE_URL is replaced by DATABASE_URL_TEST (default "file:./test.db", i.e. prisma/test.db) and
 * ACC_TEST_DB=1 is set, which the fixture seed requires before it will write anything.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

if (existsSync(".env.local")) dotenv.config({ path: ".env.local", quiet: true });

const testUrl = process.env.DATABASE_URL_TEST || "file:./test.db";
if (process.env.DATABASE_URL && testUrl === process.env.DATABASE_URL) {
  console.error("[acc] DATABASE_URL_TEST must differ from DATABASE_URL. Refusing to run.");
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: node scripts/with-test-db.mjs <command> [...args]");
  process.exit(1);
}

const r = spawnSync(cmd, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DATABASE_URL: testUrl,
    ACC_TEST_DB: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    CHECKPOINT_DISABLE: "1",
  },
});
process.exit(r.status ?? 1);
