import {
  COST_CATEGORIES,
  lineCashflow,
  type CostCategory,
  type CostLine,
  type Scenario,
  type TcoModel,
} from "./model";

export interface ScenarioResult {
  id: string;
  name: string;
  /** Cost per year, index 0 = upfront. */
  cashflow: number[];
  cumulative: number[];
  byCategory: Record<CostCategory, number[]>;
  total: number;
  npv: number;
}

export interface Comparison {
  id: string;
  name: string;
  /** Baseline cost − scenario cost, per year (positive = saving). */
  savings: number[];
  totalSavings: number;
  savingsPct: number | null;
  npvSavings: number;
  /** Years until cumulative savings turn positive (fractional), 0 if never negative, null if never. */
  paybackYears: number | null;
  /** IRR of the savings stream (needs an upfront investment), null when undefined. */
  irr: number | null;
}

export interface TcoResult {
  years: number;
  scenarios: ScenarioResult[];
  baseline: ScenarioResult;
  comparisons: Comparison[];
}

export const npv = (flows: number[], ratePct: number) =>
  flows.reduce((s, v, y) => s + v / (1 + ratePct / 100) ** y, 0);

const cum = (xs: number[]) => xs.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);

export function scenarioResult(
  s: Scenario,
  m: Pick<TcoModel, "years" | "growthPct" | "discountRatePct">,
): ScenarioResult {
  const zero = () => Array.from({ length: m.years + 1 }, () => 0);
  const byCategory = Object.fromEntries(COST_CATEGORIES.map((c) => [c, zero()])) as Record<
    CostCategory,
    number[]
  >;
  const cashflow = zero();
  for (const l of s.lines) {
    const cf = lineCashflow(l, m.years, m.growthPct);
    cf.forEach((v, y) => {
      cashflow[y] += v;
      byCategory[l.category][y] += v;
    });
  }
  return {
    id: s.id,
    name: s.name,
    cashflow,
    cumulative: cum(cashflow),
    byCategory,
    total: cashflow.reduce((a, b) => a + b, 0),
    npv: npv(cashflow, m.discountRatePct),
  };
}

/** Fractional years until cumulative savings first reach ≥ 0 after being negative. */
export function payback(savings: number[]): number | null {
  const c = cum(savings);
  if (c.every((v) => v >= 0)) return 0;
  for (let y = 1; y < c.length; y++)
    if (c[y - 1] < 0 && c[y] >= 0) return y - 1 + -c[y - 1] / (c[y] - c[y - 1]);
  return null;
}

/** IRR by bisection; defined only when the stream changes sign (an investment that pays back). */
export function irr(flows: number[]): number | null {
  if (!(flows.some((v) => v < 0) && flows.some((v) => v > 0))) return null;
  const f = (r: number) => flows.reduce((s, v, y) => s + v / (1 + r) ** y, 0);
  let lo = -0.99;
  let hi = 10;
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}

export function computeTco(m: TcoModel): TcoResult {
  const scenarios = m.scenarios.map((s) => scenarioResult(s, m));
  const baseline = scenarios.find((s) => s.id === m.baselineId) ?? scenarios[0];
  const comparisons = scenarios
    .filter((s) => s.id !== baseline.id)
    .map((s) => {
      const savings = baseline.cashflow.map((b, y) => b - s.cashflow[y]);
      const totalSavings = savings.reduce((a, b) => a + b, 0);
      return {
        id: s.id,
        name: s.name,
        savings,
        totalSavings,
        savingsPct: baseline.total ? (totalSavings / baseline.total) * 100 : null,
        npvSavings: npv(savings, m.discountRatePct),
        paybackYears: payback(savings),
        irr: irr(savings),
      };
    });
  return { years: m.years, scenarios, baseline, comparisons };
}

export interface Driver {
  id: string;
  label: string;
  /** NPV of savings with this assumption lowered / raised (base = all assumptions as entered). */
  low: number;
  high: number;
  base: number;
}

const scaleLine = (l: CostLine, f: number): CostLine =>
  l.basis === "power"
    ? { ...l, pricePerKwh: (l.pricePerKwh ?? 0) * f }
    : l.basis === "staff"
      ? { ...l, costPerFte: (l.costPerFte ?? 0) * f }
      : { ...l, amount: l.amount * f };

/**
 * Tornado: NPV of savings (baseline vs `targetId`) when one driver moves ±`swingPct`%, largest spread first.
 * Drivers: each material cost line in either scenario, plus energy price, PUE, demand growth and discount rate.
 */
export function sensitivity(m: TcoModel, targetId: string, swingPct = 20, max = 10): Driver[] {
  const base = m.scenarios.find((s) => s.id === m.baselineId);
  const target = m.scenarios.find((s) => s.id === targetId);
  if (!base || !target || base.id === target.id) return [];
  const value = (mm: TcoModel) =>
    computeTco(mm).comparisons.find((c) => c.id === targetId)?.npvSavings ?? 0;
  const lo = 1 - swingPct / 100;
  const hi = 1 + swingPct / 100;
  const withLines = (fn: (s: Scenario, l: CostLine) => CostLine): TcoModel => ({
    ...m,
    scenarios: m.scenarios.map((s) => ({ ...s, lines: s.lines.map((l) => fn(s, l)) })),
  });
  const baseValue = value(m);
  const drivers: Omit<Driver, "base">[] = [];
  for (const s of [base, target])
    for (const l of s.lines) {
      const at = (f: number) =>
        value(withLines((ss, ll) => (ss.id === s.id && ll.id === l.id ? scaleLine(ll, f) : ll)));
      drivers.push({
        id: `${s.id}:${l.id}`,
        label: `${s.name}: ${l.label}`,
        low: at(lo),
        high: at(hi),
      });
    }
  const hasPower = [base, target].some((s) => s.lines.some((l) => l.basis === "power"));
  if (hasPower) {
    const price = (f: number) =>
      value(
        withLines((_s, l) =>
          l.basis === "power" ? { ...l, pricePerKwh: (l.pricePerKwh ?? 0) * f } : l,
        ),
      );
    const pue = (f: number) =>
      value(
        withLines((_s, l) =>
          l.basis === "power" ? { ...l, pue: Math.max(1, (l.pue ?? 1) * f) } : l,
        ),
      );
    drivers.push({
      id: "energy-price",
      label: "Energy price ($/kWh, all scenarios)",
      low: price(lo),
      high: price(hi),
    });
    drivers.push({ id: "pue", label: "PUE (all scenarios)", low: pue(lo), high: pue(hi) });
  }
  drivers.push({
    id: "growth",
    label: "Demand growth ±5 pts",
    low: value({ ...m, growthPct: m.growthPct - 5 }),
    high: value({ ...m, growthPct: m.growthPct + 5 }),
  });
  drivers.push({
    id: "discount",
    label: "Discount rate ±2 pts",
    low: value({ ...m, discountRatePct: Math.max(0, m.discountRatePct - 2) }),
    high: value({ ...m, discountRatePct: m.discountRatePct + 2 }),
  });
  return drivers
    .map((d) => ({ ...d, base: baseValue }))
    .filter((d) => Math.abs(d.high - d.low) > 0.5)
    .sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low))
    .slice(0, max);
}
