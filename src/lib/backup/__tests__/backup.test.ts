import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { autoBackupDue, backupPath, toPrune } from "../auto";
import { parseBackup } from "../restore";
import { BACKUP_TABLES } from "../tables";

const EXCLUDED = new Set(["HttpCache", "JobRequest", "SourceRun"]); // caches / job bookkeeping

describe("backup coverage", () => {
  it("every Prisma model is backed up (or deliberately excluded)", () => {
    const models = [...readFileSync("prisma/schema.prisma", "utf8").matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
    const listed = new Set<string>(BACKUP_TABLES.map(([, m]) => m));
    expect(models.filter((m) => !listed.has(m) && !EXCLUDED.has(m))).toEqual([]);
    expect([...listed].filter((m) => !models.includes(m))).toEqual([]);
  });
});

describe("retention and safety", () => {
  it("keeps the newest N automatic backups", () => {
    const autos = Array.from({ length: 16 }, (_, i) => ({ file: `auto-${i}.json`, createdAt: new Date(2026, 9, i + 1).toISOString() }));
    const pruned = toPrune(autos, 14);
    expect(pruned).toEqual(["auto-1.json", "auto-0.json"]);
    expect(toPrune(autos.slice(0, 3), 14)).toEqual([]);
  });
  it("is due once per calendar day", () => {
    const now = new Date(2026, 10, 6, 9);
    expect(autoBackupDue(null, now)).toBe(true);
    expect(autoBackupDue(new Date(2026, 10, 6, 1).toISOString(), now)).toBe(false);
    expect(autoBackupDue(new Date(2026, 10, 5, 23).toISOString(), now)).toBe(true);
  });
  it("only resolves known backup names inside backups/", () => {
    expect(backupPath("auto-2026-11-06T00-00-00-000Z.json", "/b")).toBe("/b/auto-2026-11-06T00-00-00-000Z.json");
    expect(backupPath("../.env.local", "/b")).toBeNull();
    expect(backupPath("auto-x.json/../../etc", "/b")).toBeNull();
    expect(backupPath("random.json", "/b")).toBeNull();
  });
  it("rejects files that aren't ACC backups or are from a newer version", () => {
    expect(() => parseBackup({ format: "acc-pack" })).toThrow(/Not an ACC backup/);
    expect(() => parseBackup({ format: "acc-backup", version: 99, data: {} })).toThrow(/newer version/);
    expect(parseBackup({ format: "acc-backup", version: 2, exportedAt: "x", data: {} }).version).toBe(2);
  });
});
