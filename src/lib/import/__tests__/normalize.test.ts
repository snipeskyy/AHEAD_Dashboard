import { describe, expect, it } from "vitest";
import { autoMapHeaders, normalizeDomain, normalizeImportRow, normalizeTicker } from "../normalize";
import { toCsv } from "@/lib/csv";

describe("import normalization", () => {
  it("normalizes domains from URLs", () => {
    expect(normalizeDomain("https://www.Caterpillar.com/en/about?x=1")).toBe("caterpillar.com");
    expect(normalizeDomain("investor.example.co.uk:443")).toBe("investor.example.co.uk");
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
  });
  it("normalizes tickers", () => {
    expect(normalizeTicker(" $cat ")).toBe("CAT");
    expect(normalizeTicker("BRK.B")).toBe("BRK.B");
    expect(normalizeTicker("TOOLONGX")).toBeNull();
  });
  it("validates rows and defaults tier", () => {
    expect(
      normalizeImportRow({ name: "  Acme   Corp ", domain: "acme.com", tier: "STRATEGIC" }),
    ).toEqual({
      ok: true,
      value: {
        name: "Acme Corp",
        domain: "acme.com",
        ticker: null,
        industry: null,
        tier: "Strategic",
        greenhouseSlug: null,
        leverSlug: null,
      },
    });
    expect(normalizeImportRow({ name: "A" })).toMatchObject({ ok: false });
    expect(normalizeImportRow({ name: "Acme", domain: "bad domain" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("Invalid domain"),
    });
    expect(normalizeImportRow({ name: "Acme", tier: "whatever" })).toMatchObject({
      ok: true,
      value: { tier: "Growth" },
    });
  });
  it("auto-maps common header names", () => {
    expect(autoMapHeaders(["Company", "Website", "Symbol", "Sector", "Notes"])).toEqual({
      name: "Company",
      domain: "Website",
      ticker: "Symbol",
      industry: "Sector",
    });
  });
});

describe("toCsv", () => {
  it("escapes quotes/commas/newlines and guards against formula injection", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ["x,y", 'say "hi"'],
        ["=SUM(A1)", ["p", "q"]],
        [null, new Date("2026-01-01T00:00:00Z")],
      ],
    );
    expect(csv.split("\r\n")).toEqual([
      "a,b",
      '"x,y","say ""hi"""',
      "'=SUM(A1),p; q",
      ",2026-01-01T00:00:00.000Z",
    ]);
  });
});
