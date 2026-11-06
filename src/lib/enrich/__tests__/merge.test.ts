import { describe, expect, it } from "vitest";
import { completeness } from "../completeness";
import { columnValue, displayValue, employeeBand, FIELD_BY_ID, revenueBand } from "../fields";
import { decide, groupConflicts, sameValue } from "../merge";

const on = { autoApply: true };

describe("merge policy", () => {
  it("auto-fills an empty field only with a high-confidence value", () => {
    expect(
      decide(null, { field: "firmographics.industry", value: "Insurance", confidence: "high" }, on),
    ).toBe("apply");
    expect(
      decide(
        null,
        { field: "firmographics.industry", value: "Insurance", confidence: "medium" },
        on,
      ),
    ).toBe("review");
    expect(
      decide(
        null,
        { field: "firmographics.industry", value: "Insurance", confidence: "high" },
        { autoApply: false },
      ),
    ).toBe("review");
  });
  it("never overwrites a locked (user-edited) field", () => {
    const cur = { value: "Banking", confidence: "user" as const, locked: true };
    expect(
      decide(cur, { field: "firmographics.industry", value: "Insurance", confidence: "high" }, on),
    ).toBe("locked-hint");
  });
  it("respects precedence: user > verified > high > medium > low", () => {
    const verified = { value: 100, confidence: "verified" as const, locked: false };
    expect(
      decide(
        verified,
        { field: "firmographics.employeeCount", value: 120, confidence: "high" },
        on,
      ),
    ).toBe("review");
    const medium = { value: 100, confidence: "medium" as const, locked: false };
    expect(
      decide(medium, { field: "firmographics.employeeCount", value: 120, confidence: "high" }, on),
    ).toBe("apply");
    const high = { value: 100, confidence: "high" as const, locked: false };
    expect(
      decide(high, { field: "firmographics.employeeCount", value: 120, confidence: "high" }, on),
    ).toBe("review");
  });
  it("treats equal values as the same (case, trailing slash, key order)", () => {
    expect(sameValue("https://Example.com/", "https://example.com")).toBe(true);
    expect(sameValue({ a: 1, b: "X" }, { b: "x", a: 1 })).toBe(true);
    expect(
      decide(
        { value: "Acme", confidence: "low", locked: false },
        { field: "identity.legalName", value: "ACME", confidence: "high" },
        on,
      ),
    ).toBe("same");
  });
  it("always reviews list-type evidence", () => {
    expect(
      decide(null, { field: "tech:email:Microsoft 365", value: {}, confidence: "high" }, on),
    ).toBe("review");
  });
  it("groups conflicting proposals per field", () => {
    const g = groupConflicts([
      { field: "f", value: 1 },
      { field: "f", value: 2 },
      { field: "g", value: "a" },
      { field: "g", value: "A" },
    ]);
    expect(g.find((x) => x.field === "f")!.conflict).toBe(true);
    expect(g.find((x) => x.field === "g")!.conflict).toBe(false);
  });
});

describe("field catalog", () => {
  it("bands employees and revenue and mirrors columns", () => {
    expect(employeeBand(12_000)).toBe("10k–25k");
    expect(revenueBand(3e9)).toBe("$1B–$5B");
    expect(
      columnValue(FIELD_BY_ID.get("firmographics.website")!, "https://www.Example.com/about"),
    ).toBe("example.com");
    expect(
      columnValue(FIELD_BY_ID.get("firmographics.hqAddress")!, {
        city: "Springfield",
        region: "US-IL",
      }),
    ).toBe("Springfield, US-IL");
    expect(columnValue(FIELD_BY_ID.get("firmographics.description")!, "x")).toBeUndefined();
  });
  it("formats values for display", () => {
    expect(displayValue("firmographics.revenue", 2.5e9)).toBe("$2.5B");
    expect(displayValue("financials.fiscalYearEnd", "0926")).toBe("September 26");
    expect(displayValue("web.jobBoard", { provider: "greenhouse", slug: "example" })).toBe(
      "greenhouse · example",
    );
  });
});

describe("completeness", () => {
  it("weights fields by tier and lists the most valuable gaps first", () => {
    const empty = completeness({
      tier: "Strategic",
      filled: new Set(),
      contacts: 0,
      initiatives: 0,
    });
    expect(empty.pct).toBe(0);
    expect(empty.missing[0].weight).toBe(3);
    const some = completeness({
      tier: "Strategic",
      filled: new Set(["firmographics.industry", "financials.fiscalYearEnd", "manual.budgetCycle"]),
      contacts: 4,
      initiatives: 2,
    });
    expect(some.pct).toBeGreaterThan(20);
    expect(some.missing.some((m) => m.id === "manual.budgetCycle")).toBe(false);
  });
});
