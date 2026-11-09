// `npm run setup` (Phase 15): lock down local files, install the commit guard, and check disk encryption.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const chmod = (p, mode) => {
  try {
    if (existsSync(p)) chmodSync(p, mode);
  } catch {
    /* unsupported file system */
  }
};
for (const d of ["backups", "exports"]) {
  mkdirSync(d, { recursive: true });
  chmod(d, 0o700);
  for (const f of readdirSync(d)) chmod(path.join(d, f), 0o600);
}
chmod(".env.local", 0o600);
for (const f of existsSync("prisma") ? readdirSync("prisma") : [])
  if (/\.db(-journal|-wal|-shm)?$/.test(f)) chmod(path.join("prisma", f), 0o600);

if (existsSync(".git")) {
  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"]);
    console.log("[acc] Commit guard installed (blocks data, secrets and brand files from git)");
  } catch {
    console.warn("[acc] Could not install the commit guard (git not available)");
  }
}

if (process.platform === "darwin") {
  try {
    const out = execFileSync("fdesetup", ["status"], { encoding: "utf8" });
    if (/FileVault is On/.test(out))
      console.log("[acc] FileVault is on: the database is encrypted at rest");
    else
      console.warn(
        "\n[acc] WARNING: FileVault is OFF. Turn it on (System Settings → Privacy & Security → FileVault) before importing customer or internal data.\n",
      );
  } catch {
    console.warn("[acc] Could not check FileVault status");
  }
}
