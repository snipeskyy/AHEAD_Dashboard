import { describe, expect, it } from "vitest";
import { brandCss, contrast, deriveBrandTokens, hexToRgb } from "../colors";

describe("brand color tokens", () => {
  it("parses short and long hex", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("1a2b3c")).toEqual([26, 43, 60]);
    expect(hexToRgb("nope")).toBeNull();
  });
  it("keeps a readable brand color unchanged and picks a contrasting foreground", () => {
    const t = deriveBrandTokens("#1d4ed8")!;
    expect(t.light.primary).toBe("#1d4ed8");
    expect(t.light.primaryForeground).toBe("#ffffff");
    expect(t.adjusted).toBe(false);
  });
  it("darkens a too-light brand color for light mode and lightens for dark mode (AA 4.5:1)", () => {
    const t = deriveBrandTokens("#7fd3ff")!;
    expect(t.adjusted).toBe(true);
    expect(contrast(hexToRgb(t.light.primary)!, [246, 246, 244])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hexToRgb(t.dark.primary)!, [24, 24, 23])).toBeGreaterThanOrEqual(4.5);
  });
  it("emits CSS only for the brand accent", () => {
    const css = brandCss(deriveBrandTokens("#1d4ed8")!);
    expect(css).toContain(':root[data-accent="brand"]');
    expect(css).toContain(':root.dark[data-accent="brand"]');
    expect(deriveBrandTokens("red")).toBeNull();
  });
});
