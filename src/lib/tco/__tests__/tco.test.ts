import { describe, expect, it } from "vitest";
import { computeTco, irr, npv, payback, sensitivity } from "../compute";
import {
  lineBase,
  lineCashflow,
  lineFormula,
  TcoModelSchema,
  type CostLine,
  type TcoModel,
} from "../model";
import { TCO_TEMPLATES } from "../templates";

const L = (l: Partial<CostLine> & Pick<CostLine, "id" | "basis">): CostLine => ({
  label: l.id,
  category: "other",
  amount: 0,
  year: 0,
  escalationPct: 0,
  scales: false,
  ...l,
});

describe("lines", () => {
  it("power = kW × utilization × 8,760 h × PUE × $/kWh", () => {
    const p = L({
      id: "p",
      basis: "power",
      itKw: 100,
      utilizationPct: 50,
      pue: 1.5,
      pricePerKwh: 0.1,
    });
    expect(lineBase(p)).toBeCloseTo(100 * 0.5 * 8760 * 1.5 * 0.1); // 65,700
    expect(lineFormula(p)).toContain("PUE 1.5");
  });
  it("escalation and demand growth compound from year 2; one-time lands in its year", () => {
    expect(
      lineCashflow(L({ id: "a", basis: "annual", amount: 100, escalationPct: 10 }), 3, 0).map(
        (v) => Math.round(v * 100) / 100,
      ),
    ).toEqual([0, 100, 110, 121]);
    expect(lineCashflow(L({ id: "g", basis: "annual", amount: 100, scales: true }), 2, 20)).toEqual(
      [0, 100, 120],
    );
    expect(lineCashflow(L({ id: "o", basis: "one-time", amount: 500, year: 1 }), 3, 0)).toEqual([
      0, 500, 0, 0,
    ]);
    expect(lineBase(L({ id: "s", basis: "staff", fte: 2, costPerFte: 150_000 }))).toBe(300_000);
  });
});

describe("finance", () => {
  it("NPV, IRR and payback match hand calculations", () => {
    expect(npv([-1000, 500, 500, 500], 10)).toBeCloseTo(243.43, 2);
    expect(irr([-1000, 500, 500, 500])!).toBeCloseTo(23.38, 1);
    expect(irr([100, 100])).toBeNull(); // no investment, no IRR
    expect(payback([-1000, 400, 400, 400])).toBeCloseTo(2.5);
    expect(payback([100, 100])).toBe(0);
    expect(payback([-1000, 100, 100])).toBeNull();
  });
});

const model: TcoModel = TcoModelSchema.parse({
  years: 3,
  discountRatePct: 10,
  baselineId: "a",
  scenarios: [
    {
      id: "a",
      name: "Stay",
      lines: [L({ id: "run", basis: "annual", amount: 1000, category: "support" })],
    },
    {
      id: "b",
      name: "Move",
      lines: [
        L({ id: "mig", basis: "one-time", amount: 1000, category: "migration" }),
        L({ id: "run", basis: "annual", amount: 500, category: "cloud-compute" }),
      ],
    },
  ],
});

describe("comparison", () => {
  it("savings vs baseline with payback, NPV and IRR", () => {
    const r = computeTco(model);
    expect(r.baseline.total).toBe(3000);
    expect(r.scenarios[1].total).toBe(2500);
    const c = r.comparisons[0];
    expect(c.savings).toEqual([-1000, 500, 500, 500]);
    expect(c.totalSavings).toBe(500);
    expect(c.savingsPct).toBeCloseTo(16.67, 1);
    expect(c.npvSavings).toBeCloseTo(243.43, 2);
    expect(c.paybackYears).toBe(2);
    expect(r.scenarios[1].byCategory.migration).toEqual([1000, 0, 0, 0]);
  });
  it("sensitivity ranks drivers by their swing on NPV of savings", () => {
    const d = sensitivity(model, "b");
    expect(d[0].label).toMatch(/Stay: run|Move: run|Move: mig/);
    expect(
      d.every(
        (x, i) => i === 0 || Math.abs(x.high - x.low) <= Math.abs(d[i - 1].high - d[i - 1].low),
      ),
    ).toBe(true);
    expect(sensitivity(model, "a")).toEqual([]);
  });
});

describe("templates", () => {
  it("are valid and carry no prices", () => {
    for (const t of TCO_TEMPLATES) {
      const m = TcoModelSchema.parse(t.model);
      for (const s of m.scenarios)
        for (const l of s.lines) {
          expect(l.amount).toBe(0);
          expect(l.pricePerKwh ?? 0).toBe(0);
          expect(l.costPerFte ?? 0).toBe(0);
        }
      expect(computeTco(m).baseline.total).toBe(0);
    }
  });
});
