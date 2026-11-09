// Pre-commit guard (Phase 15): refuses to commit local data or secrets. Installed by `npm run setup`
// (git config core.hooksPath .githooks). Bypass only if you are sure: git commit --no-verify.
import { execFileSync } from "node:child_process";

const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const BLOCK = [
  [/^brand\/(?!README\.md$|\.gitkeep$)/, "brand pack files (company logos/colors stay local)"],
  [/(^|\/)\.env(\.|$)(?!example$)/, "environment files (secrets)"],
  [/\.(db|db-journal|sqlite|sqlite3)$/, "database files"],
  [/^(backups|exports|imports)\//, "backups / exports / imports (workspace data)"],
  [
    /\.acc-data\.json$/,
    "data-contract files (only docs/contract/example.acc-data.json may be committed)",
  ],
  [/\.(pem|key|p12)$/, "keys or certificates"],
];
const allowed = new Set(["docs/contract/example.acc-data.json", ".env.example"]);
const hits = [];
for (const f of staged) {
  if (allowed.has(f)) continue;
  for (const [re, why] of BLOCK) if (re.test(f)) hits.push(`  ${f}  (${why})`);
}
// Content check: no token or backup key values.
const diff = execFileSync("git", ["diff", "--cached", "-U0"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (/^\+.*\bacc_[A-Za-z0-9_-]{40,}/m.test(diff)) hits.push("  (a local API token, acc_…)");
if (/^\+\s*ACC_BACKUP_KEY="?[A-Za-z0-9+/=]{40,}/m.test(diff))
  hits.push("  (an ACC_BACKUP_KEY value)");

if (hits.length) {
  console.error(
    "\n[acc] Commit blocked: these must stay on this computer:\n" + hits.join("\n") + "\n",
  );
  process.exit(1);
}
