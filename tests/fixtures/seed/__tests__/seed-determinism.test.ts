import { describe, expect, it } from "vitest";
import { generateAccounts } from "../generators/accounts";
import { generateOpportunity } from "../generators/opportunities";
import { generateSignalContent } from "../generators/signals";
import { createRng } from "../rng";

describe("seed generators", () => {
  it("are deterministic for a fixed seed", () => {
    const a = generateAccounts(createRng("t"), 150);
    const b = generateAccounts(createRng("t"), 150);
    expect(a).toEqual(b);
    expect(new Set(a.map((x) => x.name)).size).toBe(150);
  });

  it("only produce fictional, reserved-TLD domains and no tickers", () => {
    for (const acc of generateAccounts(createRng("t"), 150)) {
      expect(acc.domain.endsWith(".example")).toBe(true);
      expect(acc).not.toHaveProperty("ticker");
    }
  });

  it("produces consistent opportunity stage history", () => {
    const rng = createRng("opp");
    const anchor = new Date("2026-06-01T00:00:00Z");
    for (let i = 0; i < 200; i++) {
      const o = generateOpportunity(rng, i, "acc", "Halvorsen Mutual", anchor);
      expect(o.history[0].toStage).toBe("Qualify");
      expect(o.history.at(-1)!.toStage).toBe(o.stage);
      expect(o.name.startsWith("Halvorsen — ")).toBe(true);
      if (o.stage === "ClosedWon" || o.stage === "ClosedLost") expect(o.closedAt).not.toBeNull();
    }
  });

  it("signal templates reference the account by name", () => {
    const s = generateSignalContent(
      createRng("s"),
      "Aurelian Logistics",
      "Logistics & Transportation",
    );
    expect(`${s.title} ${s.summary}`).toContain("Aurelian Logistics");
  });
});
