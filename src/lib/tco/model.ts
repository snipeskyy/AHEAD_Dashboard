import { z } from "zod";

/**
 * TCO / business-case model (Phase 11). Every number is a user-entered assumption: nothing is pre-filled with
 * company pricing or margins. Physical drivers (kW, PUE, $/kWh, FTEs) make the assumptions explicit.
 */
export const COST_CATEGORIES = [
  "hardware",
  "software",
  "support",
  "cloud-compute",
  "cloud-storage",
  "network",
  "power",
  "space",
  "staff",
  "migration",
  "other",
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  hardware: "Hardware",
  software: "Software & licensing",
  support: "Support & maintenance",
  "cloud-compute": "Cloud compute",
  "cloud-storage": "Cloud storage & egress",
  network: "Network & connectivity",
  power: "Power & cooling",
  space: "Space / colocation",
  staff: "Staff",
  migration: "Migration & one-time",
  other: "Other",
};

/**
 * Chart groups: at most 8 (the validated categorical palette); each group keeps one fixed color across
 * scenarios and filters, so color follows the cost type, never its rank.
 */
export const CHART_GROUPS: Array<{ id: string; label: string; categories: CostCategory[] }> = [
  { id: "hardware", label: "Hardware", categories: ["hardware"] },
  { id: "software", label: "Software & support", categories: ["software", "support"] },
  { id: "cloud", label: "Cloud", categories: ["cloud-compute", "cloud-storage"] },
  { id: "network", label: "Network", categories: ["network"] },
  { id: "power", label: "Power & cooling", categories: ["power"] },
  { id: "space", label: "Space / colocation", categories: ["space"] },
  { id: "staff", label: "Staff", categories: ["staff"] },
  { id: "one-time", label: "Migration & other", categories: ["migration", "other"] },
];

export const SCENARIO_KINDS = ["on-prem", "cloud", "hybrid", "colocation", "custom"] as const;

const money = z.number().min(0).max(1e12);
const pct = z.number().min(-50).max(100);

export const LineSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1).max(120),
  category: z.enum(COST_CATEGORIES),
  /** one-time: `amount` in `year` (0 = upfront). annual: `amount` per year. power / staff: computed from drivers. */
  basis: z.enum(["one-time", "annual", "power", "staff"]),
  amount: money.default(0),
  year: z.number().int().min(0).max(10).default(0),
  /** Annual price change (e.g. 3 = +3%/yr). */
  escalationPct: pct.default(0),
  /** Grows with demand (`growthPct`). */
  scales: z.boolean().default(false),
  itKw: z.number().min(0).max(1e6).optional(),
  pue: z.number().min(1).max(4).optional(),
  pricePerKwh: z.number().min(0).max(5).optional(),
  utilizationPct: z.number().min(0).max(100).optional(),
  fte: z.number().min(0).max(1e4).optional(),
  costPerFte: money.optional(),
  note: z.string().max(500).optional(),
});
export type CostLine = z.infer<typeof LineSchema>;

export const ScenarioSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(SCENARIO_KINDS).default("custom"),
  lines: z.array(LineSchema).max(80).default([]),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const TcoModelSchema = z.object({
  years: z.number().int().min(1).max(10).default(5),
  discountRatePct: z.number().min(0).max(50).default(8),
  /** Demand growth per year, applied to lines marked `scales`. */
  growthPct: pct.default(0),
  /** The scenario every other one is compared against (usually "stay as-is"). */
  baselineId: z.string().min(1).max(40),
  scenarios: z.array(ScenarioSchema).min(1).max(4),
  notes: z.string().max(4000).optional(),
});
export type TcoModel = z.infer<typeof TcoModelSchema>;

const HOURS = 8760;

/** Year-1 annual cost of a recurring line, from its drivers. One-time lines return 0 here. */
export function lineBase(l: CostLine): number {
  if (l.basis === "annual") return l.amount;
  if (l.basis === "power")
    return (
      (l.itKw ?? 0) *
      ((l.utilizationPct ?? 100) / 100) *
      HOURS *
      (l.pue ?? 1) *
      (l.pricePerKwh ?? 0)
    );
  if (l.basis === "staff") return (l.fte ?? 0) * (l.costPerFte ?? 0);
  return 0;
}

/** Cost of one line in each year 0..years (year 0 = upfront; recurring costs start in year 1). */
export function lineCashflow(l: CostLine, years: number, growthPct: number): number[] {
  const out = Array.from({ length: years + 1 }, () => 0);
  if (l.basis === "one-time") {
    if (l.year <= years) out[l.year] = l.amount;
    return out;
  }
  const base = lineBase(l);
  for (let y = 1; y <= years; y++)
    out[y] =
      base *
      (1 + l.escalationPct / 100) ** (y - 1) *
      (l.scales ? (1 + growthPct / 100) ** (y - 1) : 1);
  return out;
}

/** Plain-language formula for a line (shown next to every number in the editor and the export). */
export function lineFormula(l: CostLine): string {
  const esc = l.escalationPct ? `, +${l.escalationPct}%/yr price` : "";
  const grow = l.scales ? ", grows with demand" : "";
  if (l.basis === "one-time") return `One-time in year ${l.year}`;
  if (l.basis === "annual") return `Annual${esc}${grow}`;
  if (l.basis === "power")
    return `${l.itKw ?? 0} kW IT × ${l.utilizationPct ?? 100}% × 8,760 h × PUE ${l.pue ?? 1} × $${l.pricePerKwh ?? 0}/kWh${esc}${grow}`;
  return `${l.fte ?? 0} FTE × $${(l.costPerFte ?? 0).toLocaleString("en-US")}${esc}${grow}`;
}
