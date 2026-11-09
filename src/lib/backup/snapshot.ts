import { mkdir, writeFile } from "node:fs/promises";
import { sealBackup } from "./crypto";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { BACKUP_TABLES, delegateName } from "./tables";

/**
 * Full JSON snapshot of every user-data table (local only; nothing leaves the machine).
 * Caches and job bookkeeping (HttpCache, JobRequest, SourceRun) are intentionally excluded.
 */
export async function snapshotAll(db: PrismaClient) {
  const values = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic delegate lookup by model name
    BACKUP_TABLES.map(([, model]) => (db as any)[delegateName(model)].findMany() as Promise<unknown[]>),
  );
  const data = Object.fromEntries(BACKUP_TABLES.map(([key], i) => [key, values[i]]));
  return { format: "acc-backup", version: 3, exportedAt: new Date().toISOString(), data };
}

export const BACKUP_DIR = path.join(process.cwd(), "backups");

/** Writes `backups/<label>-<timestamp>.json` and returns its path. */
export async function writeBackupFile(db: PrismaClient, label: string) {
  const snap = await snapshotAll(db);
  await mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const stamp = snap.exportedAt.replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `${label}-${stamp}.json`);
  // Encrypted when ACC_BACKUP_KEY is set; readable only by you (0600).
  await writeFile(file, sealBackup(JSON.stringify(snap)), { mode: 0o600 });
  return file;
}
