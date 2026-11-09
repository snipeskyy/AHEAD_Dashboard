import { readFile } from "node:fs/promises";
import { Prisma, type PrismaClient } from "@prisma/client";
import { openBackup } from "./crypto";
import { BACKUP_TABLES, delegateName } from "./tables";

/** The parts of a backup file restore needs; older versions simply lack newer tables. */
export interface BackupFile {
  format: "acc-backup";
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export function parseBackup(raw: unknown): BackupFile {
  const b = raw as Partial<BackupFile> | null;
  if (!b || b.format !== "acc-backup" || typeof b.data !== "object" || !b.data) throw new Error("Not an ACC backup file");
  if (typeof b.version !== "number" || b.version > 3) throw new Error("This backup is from a newer version of ACC");
  return b as BackupFile;
}

export const readBackup = async (file: string) => parseBackup(openBackup(await readFile(file, "utf8")));

/** Json columns per model (null must be written as DbNull, not null). From Prisma's generated model metadata. */
function jsonFields(model: string): Set<string> {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  return new Set(m?.fields.filter((f) => f.type === "Json").map((f) => f.name) ?? []);
}
const tableName = (model: string) => Prisma.dmmf.datamodel.models.find((x) => x.name === model)?.dbName ?? model;

/** Counts per table in a backup (for the restore preview). */
export const backupCounts = (b: BackupFile) =>
  Object.fromEntries(BACKUP_TABLES.map(([k]) => [k, Array.isArray(b.data[k]) ? b.data[k].length : 0]));

/**
 * Replace every backed-up table with the backup's rows, in one transaction (all or nothing).
 * Foreign keys are checked at commit, so table order only matters for readability.
 * Callers write a "pre-restore" backup first.
 */
export async function restoreBackup(db: PrismaClient, b: BackupFile) {
  const restored: Record<string, number> = {};
  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("PRAGMA defer_foreign_keys = ON");
      for (const [, model] of [...BACKUP_TABLES].reverse()) await tx.$executeRawUnsafe(`DELETE FROM "${tableName(model)}"`);
      for (const [key, model] of BACKUP_TABLES) {
        const rows = (b.data[key] ?? []) as Array<Record<string, unknown>>;
        if (!rows.length) continue;
        const json = jsonFields(model);
        const data = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null && json.has(k) ? Prisma.DbNull : v])));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic delegate lookup by model name
        const delegate = (tx as any)[delegateName(model)];
        for (let i = 0; i < data.length; i += 500) await delegate.createMany({ data: data.slice(i, i + 500) });
        restored[key] = rows.length;
      }
    },
    { timeout: 300_000, maxWait: 30_000 },
  );
  return restored;
}
