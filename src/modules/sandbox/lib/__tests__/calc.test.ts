import { describe, expect, it } from "vitest";
import {
  deviceDrawKw,
  effectiveCapacity,
  failures,
  growth,
  rackCalc,
  roomCalc,
  telemetry,
} from "../calc";
import { createLibrary } from "../library";
import { SandboxSpecSchema, type SandboxSpec } from "../spec";
import { SANDBOX_TEMPLATES } from "../templates";

const lib = createLibrary();
const spec = (o: Record<string, unknown>): SandboxSpec =>
  SandboxSpecSchema.parse({ version: 2, room: {}, assumptions: { utilization: 1 }, ...o });

describe("rack", () => {
  it("draw, heat, U and weight from devices", () => {
    const s = spec({
      racks: [
        {
          id: "r",
          label: "R1",
          x: 0,
          y: 0,
          devices: [
            { id: "a", profileId: "cpu-2u", position: 1 },
            { id: "b", profileId: "tor-1u", position: 42 },
          ],
        },
      ],
    });
    const r = rackCalc(s.racks[0], lib, s);
    expect(r.usedU).toBe(3);
    expect(r.drawKw).toBeCloseTo(1.1 + 0.6); // utilization 1 → max
    expect(r.heatBtuHr).toBeCloseTo(1.7 * 3412);
    expect(r.weightKg).toBe(140 + 28 + 9);
    expect(deviceDrawKw(lib.get("cpu-2u")!, 0)).toBeCloseTo(0.33);
  });
  it("flags overlaps, out-of-rack devices, feed overload and the air ceiling", () => {
    const s = spec({
      racks: [
        {
          id: "r",
          label: "R1",
          x: 0,
          y: 0,
          kwPerFeed: 10,
          devices: [
            { id: "a", profileId: "gpu-8x-air", position: 36 },
            { id: "b", profileId: "gpu-8x-air", position: 30 },
          ],
        },
      ],
    });
    const msgs = rackCalc(s.racks[0], lib, s)
      .issues.map((i) => i.message)
      .join(" | ");
    expect(msgs).toMatch(/doesn't fit/);
    expect(msgs).toMatch(/used twice/);
    expect(msgs).toMatch(/exceeds the 10 kW feed/);
    expect(msgs).toMatch(/air-cooling ceiling/);
  });
  it("splits heat to liquid for direct-liquid devices and rear-door HX", () => {
    const s = spec({
      racks: [
        {
          id: "r",
          label: "L",
          x: 0,
          y: 0,
          cooling: "direct-liquid",
          kwPerFeed: 60,
          devices: [{ id: "g", profileId: "gpu-8x-liquid", position: 1 }],
        },
      ],
    });
    const r = rackCalc(s.racks[0], lib, s);
    expect(r.liquidKw).toBeCloseTo(11 * 0.8);
    expect(r.airKw).toBeCloseTo(11 * 0.2);
  });
});

describe("room", () => {
  it("redundancy: N, N+1 (minus largest), 2N (half)", () => {
    const u = [
      { id: "a", label: "a", kind: "crah" as const, capacityKw: 100, x: 0, y: 0 },
      { id: "b", label: "b", kind: "crah" as const, capacityKw: 60, x: 0, y: 0 },
    ];
    expect(effectiveCapacity(u, "N")).toBe(160);
    expect(effectiveCapacity(u, "N+1")).toBe(60);
    expect(effectiveCapacity(u, "2N")).toBe(80);
  });
  it("templates are valid and the AI pod is liquid-heavy with a lower PUE than the air row", () => {
    const air = roomCalc(SANDBOX_TEMPLATES.find((t) => t.id === "enterprise-row")!.spec, lib);
    const ai = roomCalc(SANDBOX_TEMPLATES.find((t) => t.id === "ai-pod")!.spec, lib);
    expect(air.liquidKw).toBe(0);
    expect(ai.liquidKw).toBeGreaterThan(ai.airKw);
    expect(ai.pue).toBeLessThan(air.pue);
    expect(air.pue).toBeGreaterThan(1.3);
    for (const t of SANDBOX_TEMPLATES)
      expect(roomCalc(t.spec, lib).issues.filter((i) => i.severity === "critical")).toEqual([]);
  });
  it("warns when liquid heat has no CDU and when UPS is exceeded", () => {
    const s = spec({
      room: { upsCapacityKw: 5 },
      racks: [
        {
          id: "r",
          label: "L",
          x: 0,
          y: 0,
          cooling: "direct-liquid",
          kwPerFeed: 60,
          devices: [{ id: "g", profileId: "gpu-8x-liquid", position: 1 }],
        },
      ],
    });
    const msgs = roomCalc(s, lib)
      .issues.map((i) => i.message)
      .join(" | ");
    expect(msgs).toMatch(/no CDU/);
    expect(msgs).toMatch(/exceeds UPS capacity/);
  });
});

describe("templates layout", () => {
  it("racks and cooling units don't overlap and stay inside the room", () => {
    for (const t of SANDBOX_TEMPLATES) {
      const boxes = [
        ...t.spec.racks.map((r) => ({ id: r.id, x: r.x, y: r.y, w: 1, h: 2 })),
        ...t.spec.coolingUnits.map((u) => ({ id: u.id, x: u.x, y: u.y, w: 2, h: 1 })),
      ];
      for (const a of boxes) {
        expect(a.x + a.w <= t.spec.room.widthTiles && a.y + a.h <= t.spec.room.depthTiles).toBe(
          true,
        );
        for (const b of boxes)
          if (a.id !== b.id)
            expect(
              a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h,
              `${t.id}: ${a.id} overlaps ${b.id}`,
            ).toBe(false);
      }
    }
  });
});

describe("what-ifs", () => {
  const t = SANDBOX_TEMPLATES.find((x) => x.id === "enterprise-row")!.spec;
  it("growth runway against the binding constraint", () => {
    const g = growth(t, lib);
    expect(g.series[0]).toBeCloseTo(roomCalc(t, lib).drawKw);
    expect(g.yearsLeft).toBeGreaterThan(0);
    expect(["UPS", "Air cooling"]).toContain(g.binding.label);
  });
  it("losing a cooling unit and feed A", () => {
    const f = failures(t, lib);
    expect(f.cooling).toHaveLength(3);
    expect(f.cooling.every((c) => c.ok)).toBe(true); // N+1 design survives one unit
    expect(f.feedA.every((x) => x.status === "ok")).toBe(true); // A/B feeds
  });
  it("telemetry is deterministic per tick", () => {
    expect(telemetry(t, lib, 5)).toEqual(telemetry(t, lib, 5));
    expect(telemetry(t, lib, 5)[0].kw).not.toBe(telemetry(t, lib, 9)[0].kw);
  });
});
