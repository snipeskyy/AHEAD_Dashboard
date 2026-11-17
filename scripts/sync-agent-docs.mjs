// `npm run agents:sync`: copies the project rules (CLAUDE.md, the single source of truth) into the files other AI
// coding tools read automatically, so any assistant that picks up this repo follows the same rules.
//   AGENTS.md                         (Codex, Cursor, Jules, many internal agents; keeps Next.js's own block)
//   .github/copilot-instructions.md   (GitHub Copilot)
//   .cursor/rules/acc.mdc             (Cursor)
// A unit test fails if these drift from CLAUDE.md. Edit CLAUDE.md, then run this.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const rules = readFileSync("CLAUDE.md", "utf8").trim();
const note =
  "<!-- Generated from CLAUDE.md by `npm run agents:sync`. Edit CLAUDE.md (the source of truth), not this file. -->";
const body = `${note}\n\n${rules}\n`;

export const BEGIN = "<!-- BEGIN:acc-rules -->";
export const END = "<!-- END:acc-rules -->";

export function agentsMd(existing) {
  const block = `${BEGIN}\n\n${body}\n${END}`;
  if (existing.includes(BEGIN) && existing.includes(END))
    return (
      existing.slice(0, existing.indexOf(BEGIN)) +
      block +
      existing.slice(existing.indexOf(END) + END.length)
    );
  return `${existing.trimEnd()}\n\n${block}\n`;
}
export const copilotMd = () => body;
export const cursorMdc = () =>
  `---\ndescription: Account Command Center project rules (from CLAUDE.md)\nalwaysApply: true\n---\n\n${body}`;

if (process.argv[1]?.endsWith("sync-agent-docs.mjs")) {
  writeFileSync(
    "AGENTS.md",
    agentsMd(existsSync("AGENTS.md") ? readFileSync("AGENTS.md", "utf8") : ""),
  );
  mkdirSync(".github", { recursive: true });
  writeFileSync(".github/copilot-instructions.md", copilotMd());
  mkdirSync(".cursor/rules", { recursive: true });
  writeFileSync(".cursor/rules/acc.mdc", cursorMdc());
  console.log(
    "[acc] Synced AGENTS.md, .github/copilot-instructions.md and .cursor/rules/acc.mdc from CLAUDE.md",
  );
}
