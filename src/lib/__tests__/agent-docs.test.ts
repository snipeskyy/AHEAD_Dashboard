import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { agentsMd, copilotMd, cursorMdc } from "../../../scripts/sync-agent-docs.mjs";

const read = (f: string) => readFileSync(f, "utf8");

describe("AI tool rule files stay in sync with CLAUDE.md (run npm run agents:sync)", () => {
  it("AGENTS.md, Copilot and Cursor copies match", () => {
    expect(read("AGENTS.md")).toBe(agentsMd(read("AGENTS.md")));
    expect(read(".github/copilot-instructions.md")).toBe(copilotMd());
    expect(read(".cursor/rules/acc.mdc")).toBe(cursorMdc());
  });
  it("keeps the Next.js-managed block in AGENTS.md", () => {
    expect(read("AGENTS.md")).toContain("BEGIN:nextjs-agent-rules");
  });
});
