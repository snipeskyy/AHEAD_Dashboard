import { describe, expect, it } from "vitest";
import { toFtsQuery } from "../types";

describe("toFtsQuery", () => {
  it("builds prefix terms and strips FTS syntax", () => {
    expect(toFtsQuery("gpu clus")).toBe('"gpu"* "clus"*');
    expect(toFtsQuery('  "drop" OR (x*) ')).toBe('"drop"* "or"* "x"*');
    expect(toFtsQuery("   ")).toBeNull();
    expect(toFtsQuery("M&A")).toBe('"m&a"*');
  });
});
