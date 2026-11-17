// `npm run handoff`: packages the CODE for another AI tool or team as handoff/acc-<date>-<commit>.zip.
// Uses `git archive`, so only committed files are included: never your database, backups, exports, imports,
// .env.local (keys), brand pack or screenshots. The zip is then checked against the same blocklist as the
// commit guard, and refused if anything sensitive slipped in.
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";

const git = (...a) =>
  execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

const dirty = git("status", "--porcelain", "--untracked-files=no");
if (dirty)
  console.warn(
    "[acc] Note: uncommitted changes are NOT included (only the last commit is packaged).",
  );

const sha = git("rev-parse", "--short", "HEAD");
const day = new Date().toISOString().slice(0, 10);
mkdirSync("handoff", { recursive: true });
const out = `handoff/acc-${day}-${sha}.zip`;
git("archive", "--format=zip", `--prefix=account-command-center/`, "-o", out, "HEAD");

const files = git("ls-tree", "-r", "--name-only", "HEAD").split("\n");
const BLOCK = [
  /^brand\/(?!README\.md$|\.gitkeep$)/,
  /(^|\/)\.env(?!\.example$)(\.|$)/,
  /\.(db|db-journal|sqlite|sqlite3|pem|key|p12)$/,
  /^(backups|exports|imports|handoff|screenshots)\//,
  /\.acc-data\.json$/,
];
const allowed = new Set(["docs/contract/example.acc-data.json", ".env.example"]);
const bad = files.filter((f) => !allowed.has(f) && BLOCK.some((re) => re.test(f)));
if (bad.length) {
  console.error(
    `[acc] Refusing: the commit contains files that must stay local:\n  ${bad.join("\n  ")}`,
  );
  execFileSync("rm", ["-f", out]);
  process.exit(1);
}
const mb = (statSync(out).size / 1024 / 1024).toFixed(1);
console.log(
  `[acc] Wrote ${out} (${files.length} files, ${mb} MB). Contains code and docs only, no data or keys.`,
);
console.log(
  "[acc] Start the other AI with docs/HANDOFF.md (or docs/AI_CONTEXT.md for chat tools).",
);
