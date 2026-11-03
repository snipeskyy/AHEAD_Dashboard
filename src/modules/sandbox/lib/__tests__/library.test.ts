import { describe, expect, it } from "vitest";
import { createLibrary, ILLUSTRATIVE_PROFILES, PREVIEW_RACKS } from "../library";

describe("sandbox illustrative library", () => {
  it("labels every profile illustrative and uses no vendor names", () => {
    for (const p of ILLUSTRATIVE_PROFILES) {
      expect(p.illustrative).toBe(true);
      expect(p.label).toMatch(/^(GPU|CPU|Storage|Top-of-rack|Spine|Rack PDU|Coolant)/);
    }
    expect(createLibrary().disclaimer).toMatch(/not vendor-certified/i);
  });

  it("preview racks fit and reference known profiles without overlap", () => {
    const lib = createLibrary();
    for (const r of PREVIEW_RACKS) {
      const used = new Set<number>();
      for (const d of r.devices) {
        const prof = lib.get(d.profileId)!;
        expect(prof).toBeDefined();
        for (let u = d.position; u < d.position + prof.heightU; u++) {
          expect(u).toBeLessThanOrEqual(r.heightU);
          expect(used.has(u)).toBe(false);
          used.add(u);
        }
      }
    }
  });
});
