import { describe, expect, it } from "vitest";
import {
  accountsKind,
  contactsKind,
  notesKind,
  opportunitiesKind,
  partnerRepsKind,
} from "../kinds";
import { inferSeniority } from "../kinds/contacts";
import { applyMapping, autoMap, mappingFits, parsePastedList, templateCsv } from "../mapping";
import { matchEnum, normalizeLegalName, parseAmount, parseDate, parsePercent } from "../values";

describe("value parsers", () => {
  it("parses amounts with suffixes and separators", () => {
    expect(parseAmount("$1.2M")).toBe(1_200_000);
    expect(parseAmount("250k")).toBe(250_000);
    expect(parseAmount("1,200,000")).toBe(1_200_000);
    expect(parseAmount("USD 40000")).toBe(40_000);
    expect(parseAmount("lots")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
  it("parses ISO, US and long-form dates at UTC midnight", () => {
    expect(parseDate("2026-03-31")?.toISOString()).toBe("2026-03-31T00:00:00.000Z");
    expect(parseDate("3/31/2026")?.toISOString()).toBe("2026-03-31T00:00:00.000Z");
    expect(parseDate("2/30/2026")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });
  it("parses percents and fractions", () => {
    expect(parsePercent("40%")).toBe(40);
    expect(parsePercent("0.4")).toBe(40);
    expect(parsePercent("140")).toBeNull();
  });
  it("matches enums by id, label or synonym, ignoring case and punctuation", () => {
    expect(matchEnum("strategic", ["Strategic", "Growth"] as const)).toBe("Strategic");
    expect(matchEnum("Closed won", ["ClosedWon"] as const)).toBe("ClosedWon");
    expect(matchEnum("x", ["A"] as const, {}, { x: "A" })).toBe("A");
    expect(matchEnum("nope", ["A"] as const)).toBeNull();
  });
  it("normalizes legal names for dedupe", () => {
    expect(normalizeLegalName("The Example Holdings, Inc.")).toBe(normalizeLegalName("example"));
    expect(normalizeLegalName("Smith & Sons LLC")).toBe("smith and sons");
  });
});

describe("column mapping", () => {
  it("auto-maps aliases, then labels, using each header once", () => {
    const m = autoMap(accountsKind.fields, [
      "Company",
      "Website",
      "Symbol",
      "Sector",
      "Tier",
      "Junk",
    ]);
    expect(m).toMatchObject({
      name: "Company",
      domain: "Website",
      ticker: "Symbol",
      industry: "Sector",
      tier: "Tier",
    });
    expect(Object.values(m)).not.toContain("Junk");
    const fromTemplate = autoMap(
      opportunitiesKind.fields,
      opportunitiesKind.fields.map((f) => f.label),
    );
    expect(Object.keys(fromTemplate).sort()).toEqual(
      opportunitiesKind.fields.map((f) => f.id).sort(),
    );
  });
  it("applies a mapping and checks whether a saved one fits", () => {
    expect(applyMapping([{ Company: "A", X: "1" }], { name: "Company" })).toEqual([{ name: "A" }]);
    expect(mappingFits({ name: "Company" }, ["Company"])).toBe(true);
    expect(mappingFits({ name: "Account" }, ["Company"])).toBe(false);
  });
  it("parses pasted lists with optional domains", () => {
    expect(
      parsePastedList(
        "Acme Corp\nBeta Inc, beta.example\n- Gamma (gamma.example)\n\n2. Delta\tdelta.example",
      ),
    ).toEqual([
      { Company: "Acme Corp", Domain: "" },
      { Company: "Beta Inc", Domain: "beta.example" },
      { Company: "Gamma", Domain: "gamma.example" },
      { Company: "Delta", Domain: "delta.example" },
    ]);
  });
  it("builds a template that maps back onto every field", () => {
    const [head] = templateCsv(contactsKind.fields).split("\n");
    expect(head.split(",").length).toBe(contactsKind.fields.length);
  });
});

describe("import kinds", () => {
  it("accounts: validates domain/ticker/tier and keeps tier null when blank", () => {
    const ok = accountsKind.normalize({
      name: " Example  Co ",
      domain: "https://www.Example.com/x",
      ticker: "exmp",
      tier: "",
    });
    expect(ok).toMatchObject({
      ok: true,
      value: { name: "Example Co", domain: "example.com", ticker: "EXMP", tier: null },
    });
    const bad = accountsKind.normalize({ name: "E", domain: "nope", tier: "Gold" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.map((e) => e.field)).toEqual(["name", "domain", "tier"]);
  });
  it("contacts: infers seniority, defaults role, rejects unknown enums", () => {
    expect(inferSeniority("Chief Information Officer")).toBe("C-Level");
    expect(inferSeniority("SVP, Infrastructure")).toBe("VP");
    expect(inferSeniority("Head of Platform")).toBe("Director");
    const r = contactsKind.normalize({
      account: "Example",
      title: "VP, IT",
      buyingRole: "economic buyer",
    });
    expect(r).toMatchObject({
      ok: true,
      value: {
        seniority: "VP",
        buyingRole: "EconomicBuyer",
        engagement: "None",
        function: "Other",
      },
    });
    expect(contactsKind.normalize({ account: "Example", title: "VP", buyingRole: "boss" }).ok).toBe(
      false,
    );
  });
  it("opportunities: maps practice labels, stages and amounts", () => {
    const r = opportunitiesKind.normalize({
      account: "Example",
      name: "Pilot",
      practiceArea: "AI Infra",
      stage: "closed won",
      amount: "250k",
      closeDate: "12/15/2026",
    });
    expect(r).toMatchObject({
      ok: true,
      value: { practiceArea: "ai-infra", stage: "ClosedWon", amount: 250_000, probability: null },
    });
    const bad = opportunitiesKind.normalize({
      account: "",
      name: "P",
      practiceArea: "Gardening",
      amount: "x",
      closeDate: "",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBeGreaterThanOrEqual(5);
  });
  it("notes and partner reps", () => {
    expect(
      notesKind.normalize({ account: "Example", body: "Hello there", date: "2026-01-02" }).ok,
    ).toBe(true);
    expect(notesKind.normalize({ account: "Example", body: "" }).ok).toBe(false);
    expect(
      partnerRepsKind.normalize({
        partnerCompany: "Compute OEM A",
        name: "Sam",
        accounts: "a.example; B Co | c",
      }),
    ).toMatchObject({
      ok: true,
      value: { accounts: ["a.example", "B Co", "c"] },
    });
  });
});
