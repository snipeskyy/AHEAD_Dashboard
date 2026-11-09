import type { CostLine, Scenario, TcoModel } from "./model";

/**
 * Starter structures only. Every dollar amount starts at 0 for the user to enter from their own quotes and
 * the customer's numbers; no pricing or margins are built in. The only pre-filled physical assumption is a
 * typical PUE, labeled as such so it gets replaced with the customer's measured value.
 */
type L = Partial<CostLine> & Pick<CostLine, "id" | "label" | "category" | "basis">;
const line = (l: L): CostLine => ({ amount: 0, year: 0, escalationPct: 0, scales: false, ...l });
const scenario = (id: string, name: string, kind: Scenario["kind"], lines: L[]): Scenario => ({
  id,
  name,
  kind,
  lines: lines.map(line),
});

const power = (id: string, pue: number): L => ({
  id,
  label: "IT power & cooling",
  category: "power",
  basis: "power",
  itKw: 0,
  utilizationPct: 70,
  pue,
  pricePerKwh: 0,
  note: `PUE ${pue} is a typical figure; replace it with the measured value.`,
});
const staff = (id: string): L => ({
  id,
  label: "Operations staff",
  category: "staff",
  basis: "staff",
  fte: 0,
  costPerFte: 0,
});

export const TCO_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  model: TcoModel;
}> = [
  {
    id: "refresh-vs-cloud",
    name: "On-prem refresh vs public cloud",
    description: "Refresh and keep running on-prem, or migrate the workload to public cloud.",
    model: {
      years: 5,
      discountRatePct: 8,
      growthPct: 0,
      baselineId: "onprem",
      scenarios: [
        scenario("onprem", "Refresh on-prem", "on-prem", [
          { id: "hw", label: "Server & storage refresh", category: "hardware", basis: "one-time" },
          { id: "sw", label: "Software & licensing", category: "software", basis: "annual" },
          { id: "sup", label: "Hardware support", category: "support", basis: "annual" },
          power("pwr", 1.5),
          { id: "spc", label: "Data center space", category: "space", basis: "annual" },
          staff("ops"),
        ]),
        scenario("cloud", "Migrate to public cloud", "cloud", [
          { id: "mig", label: "Migration services", category: "migration", basis: "one-time" },
          {
            id: "cmp",
            label: "Compute (reserved + on-demand)",
            category: "cloud-compute",
            basis: "annual",
            scales: true,
          },
          {
            id: "sto",
            label: "Storage & egress",
            category: "cloud-storage",
            basis: "annual",
            scales: true,
          },
          { id: "net", label: "Connectivity", category: "network", basis: "annual" },
          { id: "sw", label: "Software & licensing", category: "software", basis: "annual" },
          staff("ops"),
        ]),
      ],
    },
  },
  {
    id: "dc-to-colo",
    name: "Own data center vs colocation",
    description: "Keep operating an owned facility, or move the estate into a colocation provider.",
    model: {
      years: 5,
      discountRatePct: 8,
      growthPct: 0,
      baselineId: "own",
      scenarios: [
        scenario("own", "Owned data center", "on-prem", [
          power("pwr", 1.7),
          {
            id: "fac",
            label: "Facility (lease, maintenance, insurance)",
            category: "space",
            basis: "annual",
          },
          {
            id: "cap",
            label: "Facility upgrades (UPS, cooling)",
            category: "hardware",
            basis: "one-time",
            year: 1,
          },
          staff("ops"),
        ]),
        scenario("colo", "Colocation", "colocation", [
          { id: "mig", label: "Move & migration", category: "migration", basis: "one-time" },
          {
            id: "spc",
            label: "Colocation space & cross-connects",
            category: "space",
            basis: "annual",
            escalationPct: 3,
          },
          power("pwr", 1.4),
          { id: "net", label: "Carrier connectivity", category: "network", basis: "annual" },
          staff("ops"),
        ]),
      ],
    },
  },
  {
    id: "gpu-onprem-vs-cloud",
    name: "AI infrastructure: on-prem GPU vs cloud GPU",
    description: "Buy and run GPU clusters, or rent GPU capacity in the cloud.",
    model: {
      years: 3,
      discountRatePct: 8,
      growthPct: 0,
      baselineId: "cloudgpu",
      scenarios: [
        scenario("cloudgpu", "Cloud GPU instances", "cloud", [
          {
            id: "gpu",
            label: "GPU instance hours",
            category: "cloud-compute",
            basis: "annual",
            scales: true,
          },
          {
            id: "sto",
            label: "Storage & data egress",
            category: "cloud-storage",
            basis: "annual",
            scales: true,
          },
          staff("ops"),
        ]),
        scenario("onpremgpu", "On-prem GPU cluster", "on-prem", [
          { id: "srv", label: "GPU servers", category: "hardware", basis: "one-time" },
          { id: "fab", label: "Network fabric & storage", category: "hardware", basis: "one-time" },
          { id: "sw", label: "AI platform software", category: "software", basis: "annual" },
          { id: "sup", label: "Support", category: "support", basis: "annual" },
          power("pwr", 1.3),
          { id: "spc", label: "Space (high-density racks)", category: "space", basis: "annual" },
          staff("ops"),
        ]),
      ],
    },
  },
  {
    id: "blank",
    name: "Blank comparison",
    description: "Two empty scenarios to build from scratch.",
    model: {
      years: 5,
      discountRatePct: 8,
      growthPct: 0,
      baselineId: "current",
      scenarios: [
        scenario("current", "Current state", "custom", []),
        scenario("proposed", "Proposed", "custom", []),
      ],
    },
  },
];
