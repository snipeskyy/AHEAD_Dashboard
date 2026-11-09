import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { backupKey, isEncrypted, openBackup, sealBackup } from "../crypto";

const key = randomBytes(32);
const backup = JSON.stringify({
  format: "acc-backup",
  version: 3,
  exportedAt: "x",
  data: { accounts: [{ name: "Fictional Co" }] },
});

describe("backup encryption", () => {
  it("round-trips through AES-256-GCM and hides the content", () => {
    const sealed = sealBackup(backup, key);
    expect(isEncrypted(sealed)).toBe(true);
    expect(sealed).not.toContain("Fictional Co");
    expect(openBackup(sealed, key)).toEqual(JSON.parse(backup));
  });
  it("reads old plain backups and writes plain when no key is set", () => {
    expect(sealBackup(backup, null)).toBe(backup);
    expect(openBackup(backup, key)).toEqual(JSON.parse(backup));
  });
  it("refuses a wrong or missing key, and a tampered file", () => {
    const sealed = sealBackup(backup, key);
    expect(() => openBackup(sealed, randomBytes(32))).toThrow(/doesn't match/);
    expect(() => openBackup(sealed, null)).toThrow(/encrypted/);
    const t = JSON.parse(sealed);
    t.data = Buffer.from("tampered").toString("base64");
    expect(() => openBackup(JSON.stringify(t), key)).toThrow();
  });
  it("validates the key format", () => {
    expect(backupKey({ ACC_BACKUP_KEY: "" })).toBeNull();
    expect(() => backupKey({ ACC_BACKUP_KEY: "short" })).toThrow(/32 bytes/);
    expect(backupKey({ ACC_BACKUP_KEY: key.toString("base64") })?.length).toBe(32);
  });
});
