// Creates .env.local from .env.example on first install so Prisma + the worker have a DATABASE_URL, and (Phase 15)
// adds a random ACC_BACKUP_KEY so backups are encrypted. The key never leaves .env.local (git-ignored).
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

if (!existsSync(".env.local") && existsSync(".env.example")) {
  copyFileSync(".env.example", ".env.local");
  console.log("[acc] Created .env.local from .env.example");
}
if (existsSync(".env.local")) {
  const env = readFileSync(".env.local", "utf8");
  if (!/^ACC_BACKUP_KEY="?[A-Za-z0-9+/=_-]{40,}/m.test(env)) {
    const key = randomBytes(32).toString("base64");
    if (/^ACC_BACKUP_KEY=.*$/m.test(env))
      writeFileSync(".env.local", env.replace(/^ACC_BACKUP_KEY=.*$/m, `ACC_BACKUP_KEY="${key}"`));
    else
      appendFileSync(
        ".env.local",
        `\n# Encrypts backups (AES-256-GCM). Keep a copy somewhere safe (e.g. your password manager):\n# without it, encrypted backups can't be restored.\nACC_BACKUP_KEY="${key}"\n`,
      );
    console.log(
      "[acc] Added ACC_BACKUP_KEY to .env.local (backups are now encrypted; keep a copy of the key)",
    );
  }
  try {
    chmodSync(".env.local", 0o600);
  } catch {
    /* not supported on this file system */
  }
}
