import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { backupPath, listBackups } from "@/lib/backup/auto";
import { backupCounts, parseBackup, readBackup, restoreBackup } from "@/lib/backup/restore";
import { BACKUP_DIR, writeBackupFile } from "@/lib/backup/snapshot";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { createSqliteSearchProvider } from "@/lib/search/sqlite-provider";
import { HttpError } from "./http";

export { listBackups };

export async function createManualBackup() {
  const file = path.basename(await writeBackupFile(db, "manual"));
  await audit(db, { action: "backup.create", entityType: "backup", entityId: file, summary: `Backup written: ${file}` });
  return file;
}

function resolve(name: string) {
  const p = backupPath(name);
  if (!p) throw new HttpError(400, "Unknown backup file");
  return p;
}

export async function previewBackup(name: string) {
  const b = await readBackup(resolve(name)).catch((e: Error) => {
    throw new HttpError(400, e.message.includes("ENOENT") ? "Backup not found" : e.message);
  });
  return { file: name, version: b.version, exportedAt: b.exportedAt, counts: backupCounts(b) };
}

/** Save an uploaded backup into backups/ (validated first) so it can be previewed and restored like the others. */
export async function saveUploadedBackup(text: string) {
  let parsed;
  try {
    parsed = parseBackup(JSON.parse(text));
  } catch (e) {
    throw new HttpError(400, e instanceof Error && !e.message.startsWith("Unexpected") ? e.message : "That file isn't valid JSON");
  }
  await mkdir(BACKUP_DIR, { recursive: true });
  const name = `manual-upload-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await writeFile(path.join(BACKUP_DIR, name), JSON.stringify(parsed));
  return name;
}

/** Restore = safety backup of the current data, then replace everything with the chosen backup (one transaction). */
export async function restoreFromBackup(name: string) {
  const b = await readBackup(resolve(name));
  const safety = path.basename(await writeBackupFile(db, "pre-restore"));
  const restored = await restoreBackup(db, b);
  await createSqliteSearchProvider(db).rebuild();
  const total = Object.values(restored).reduce((s, n) => s + n, 0);
  await audit(db, { action: "backup.restore", entityType: "backup", entityId: name, summary: `Restored ${name} (${total} rows); previous data saved as ${safety}` });
  return { restored, safety };
}
