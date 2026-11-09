import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Backup encryption (Phase 15). Backups hold the whole workspace, including internal data, so they are written as an
 * AES-256-GCM envelope when `ACC_BACKUP_KEY` (32 random bytes, base64; created in .env.local by `npm install`) is set.
 * Plain `acc-backup` JSON is still readable, so older backups restore.
 */
export const ENVELOPE_FORMAT = "acc-backup-encrypted";

export function backupKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.ACC_BACKUP_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ACC_BACKUP_KEY must be 32 bytes, base64-encoded");
  return key;
}

/** JSON text of a backup → what is written to disk (encrypted when a key is available). */
export function sealBackup(json: string, key: Buffer | null = backupKey()): string {
  if (!key) return json;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  return JSON.stringify({
    format: ENVELOPE_FORMAT,
    v: 1,
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}

/** File text → backup JSON value (decrypting an envelope; plain backups pass through). */
export function openBackup(text: string, key: Buffer | null = backupKey()): unknown {
  const raw = JSON.parse(text) as { format?: string; iv?: string; tag?: string; data?: string };
  if (raw?.format !== ENVELOPE_FORMAT) return raw;
  if (!key)
    throw new Error(
      "This backup is encrypted. Set ACC_BACKUP_KEY in .env.local to the key it was made with.",
    );
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(raw.iv!, "base64"));
    d.setAuthTag(Buffer.from(raw.tag!, "base64"));
    const json = Buffer.concat([d.update(Buffer.from(raw.data!, "base64")), d.final()]).toString(
      "utf8",
    );
    return JSON.parse(json);
  } catch {
    throw new Error(
      "Could not decrypt this backup: ACC_BACKUP_KEY doesn't match the key it was made with.",
    );
  }
}

export const isEncrypted = (text: string) => text.includes(`"format":"${ENVELOPE_FORMAT}"`);
