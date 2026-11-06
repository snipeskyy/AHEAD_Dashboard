import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { BACKUP_DIR, writeBackupFile } from "./snapshot";

export const BACKUP_NAME = /^(auto|manual|pre-purge|pre-reset|pre-restore|pre-import)-[\w-]+\.json$/;

export interface BackupInfo {
  file: string;
  kind: string;
  size: number;
  createdAt: string;
}

/** Backup files in backups/, newest first. Only names matching BACKUP_NAME are ever listed or served. */
export async function listBackups(dir = BACKUP_DIR): Promise<BackupInfo[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const out: BackupInfo[] = [];
  for (const n of names.filter((x) => BACKUP_NAME.test(x))) {
    const s = await stat(path.join(dir, n));
    out.push({ file: n, kind: n.split("-")[0] === "pre" ? n.split("-").slice(0, 2).join("-") : n.split("-")[0], size: s.size, createdAt: s.mtime.toISOString() });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Resolve a user-supplied backup name to a path inside backups/, or null (no traversal, known names only). */
export function backupPath(name: string, dir = BACKUP_DIR) {
  const base = path.basename(name);
  return base === name && BACKUP_NAME.test(base) ? path.join(dir, base) : null;
}

/** Pure: which automatic backups to delete so only the newest `keep` remain. */
export function toPrune(autos: Array<{ file: string; createdAt: string }>, keep: number) {
  return [...autos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(Math.max(1, keep)).map((a) => a.file);
}

/** Pure: is an automatic backup due (none yet today, local date)? */
export function autoBackupDue(latest: string | null, now: Date) {
  if (!latest) return true;
  return new Date(latest).toDateString() !== now.toDateString();
}

/** Daily automatic backup with retention (worker). Returns what happened, for the log. */
export async function runAutoBackup(db: PrismaClient, opts: { keep: number; now?: Date; dir?: string }) {
  const now = opts.now ?? new Date();
  const autos = (await listBackups(opts.dir)).filter((b) => b.kind === "auto");
  if (!autoBackupDue(autos[0]?.createdAt ?? null, now)) return { written: null, pruned: [] as string[] };
  const written = await writeBackupFile(db, "auto");
  const after = (await listBackups(opts.dir)).filter((b) => b.kind === "auto");
  const pruned = toPrune(after, opts.keep);
  for (const f of pruned) await unlink(path.join(opts.dir ?? BACKUP_DIR, f)).catch(() => undefined);
  return { written: path.basename(written), pruned };
}
