import "server-only";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { backupKey, isEncrypted } from "@/lib/backup/crypto";
import { BACKUP_DIR } from "@/lib/backup/snapshot";
import { getSetting } from "@/lib/settings/server";

const run = promisify(execFile);

export interface Check {
  id: string;
  label: string;
  status: "ok" | "warn" | "info";
  detail: string;
}

async function diskEncryption(): Promise<Check> {
  const base = { id: "disk", label: "Disk encryption (database at rest)" };
  if (process.platform !== "darwin")
    return {
      ...base,
      status: "info",
      detail: "Check that this computer's disk is encrypted (BitLocker / LUKS).",
    };
  try {
    const { stdout } = await run("fdesetup", ["status"], { timeout: 3000 });
    return /FileVault is On/.test(stdout)
      ? { ...base, status: "ok", detail: "FileVault is on." }
      : {
          ...base,
          status: "warn",
          detail:
            "FileVault is off. Turn it on (System Settings → Privacy & Security) before importing customer or internal data.",
        };
  } catch {
    return { ...base, status: "info", detail: "Couldn't read FileVault status." };
  }
}

async function backups(): Promise<Check> {
  const base = { id: "backups", label: "Encrypted backups" };
  let key: Buffer | null = null;
  try {
    key = backupKey();
  } catch (e) {
    return {
      ...base,
      status: "warn",
      detail: e instanceof Error ? e.message : "Invalid ACC_BACKUP_KEY",
    };
  }
  if (!key)
    return {
      ...base,
      status: "warn",
      detail: "ACC_BACKUP_KEY isn't set, so backups are plain JSON. Run npm install to create one.",
    };
  const files = (await readdir(BACKUP_DIR).catch(() => [] as string[]))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  const plain: string[] = [];
  for (const f of files.slice(0, 50)) {
    const head = (await readFile(path.join(BACKUP_DIR, f), "utf8").catch(() => "")).slice(0, 200);
    if (head && !isEncrypted(head)) plain.push(f);
  }
  return plain.length
    ? {
        ...base,
        status: "warn",
        detail: `New backups are encrypted, but ${plain.length} older backup file(s) are plain JSON. Delete them from backups/ once you have an encrypted one.`,
      }
    : {
        ...base,
        status: "ok",
        detail:
          "Backups are AES-256-GCM encrypted. Keep a copy of ACC_BACKUP_KEY in your password manager.",
      };
}

async function commitGuard(): Promise<Check> {
  const base = { id: "git", label: "Commit guard" };
  try {
    const { stdout } = await run("git", ["config", "core.hooksPath"], { timeout: 3000 });
    if (stdout.trim() === ".githooks")
      return {
        ...base,
        status: "ok",
        detail: "Database, backups, exports, keys and brand files can't be committed.",
      };
  } catch {
    /* not a git checkout or hook not set */
  }
  return {
    ...base,
    status: "info",
    detail: "Run npm run setup to install it (only matters if you work in the git checkout).",
  };
}

/** The security checklist shown in Settings → Data contract & API. Read-only; never returns secrets. */
export async function securityChecklist(req: Request): Promise<Check[]> {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  const api = await getSetting("api.local");
  return [
    await diskEncryption(),
    await backups(),
    {
      id: "network",
      label: "Only reachable from this computer",
      status: local ? "ok" : "warn",
      detail: local
        ? "ACC listens on 127.0.0.1 (npm run dev / npm start)."
        : `You opened ACC as "${host}", so it is reachable over the network. Use npm run dev / npm start, which bind to 127.0.0.1.`,
    },
    {
      id: "api",
      label: "Local API",
      status: api.enabled && api.allowStaging ? "info" : "ok",
      detail: !api.enabled
        ? "Off."
        : `On (token required)${api.allowStaging ? "; tools can send files for review" : "; read-only"}. Turn it off when you aren't using it.`,
    },
    await commitGuard(),
  ];
}
