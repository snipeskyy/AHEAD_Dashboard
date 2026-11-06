import { DEFAULT_PRACTICE_AREAS } from "../../../../src/config/practice-areas";
import type { BuyingRole, PracticeStatus, Tier } from "../../../../src/lib/domain/enums";
import { EMPLOYEE_BANDS, INDUSTRIES, NAME_ROOTS, REVENUE_BANDS, STATES } from "../names";
import type { Rng } from "../rng";

export interface SeedAccount {
  id: string;
  name: string;
  domain: string;
  industry: string;
  subIndustry: string;
  hq: string;
  employeeBand: string;
  revenueBand: string;
  tier: Tier;
  ownerNotes: string | null;
}

export function generateAccounts(rng: Rng, count: number): SeedAccount[] {
  const used = new Set<string>();
  const out: SeedAccount[] = [];
  const industryWeights = INDUSTRIES.map((i) => [i, i.weight] as const);
  let misses = 0;
  while (out.length < count) {
    const ind = rng.weighted(industryWeights);
    let name = `${rng.pick(NAME_ROOTS)} ${rng.pick(ind.suffixes)}`;
    // Large (perf) runs exhaust the root × suffix pool: number the rare repeats instead of looping.
    if (used.has(name) && ++misses > 200) name = `${name} ${out.length + 1}`;
    if (used.has(name)) continue;
    misses = 0;
    used.add(name);
    const n = out.length + 1;
    const tier = rng.weighted<Tier>([
      ["Strategic", 2],
      ["Growth", 4],
      ["Maintain", 4],
    ]);
    const sizeIdx =
      tier === "Strategic" ? rng.int(2, 4) : tier === "Growth" ? rng.int(1, 3) : rng.int(0, 2);
    out.push({
      id: `demo-acc-${String(n).padStart(3, "0")}`,
      name,
      domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
      industry: ind.industry,
      subIndustry: rng.pick(ind.subIndustries),
      hq: rng.pick(STATES),
      employeeBand: EMPLOYEE_BANDS[sizeIdx],
      revenueBand: REVENUE_BANDS[Math.min(4, sizeIdx + rng.int(0, 1))],
      tier,
      ownerNotes: rng.bool(0.4) ? rng.pick(OWNER_NOTES) : null,
    });
  }
  return out;
}

const OWNER_NOTES = [
  "Exec sponsor prefers quarterly in-person briefings.",
  "Procurement runs a strict RFP process above $250k.",
  "Recently reorganized IT under a new CIO — re-map the committee.",
  "Strong relationship with infrastructure team; weak with security.",
  "Budget cycle closes in Q3; get ahead of planning season.",
  "Prefers outcomes-based proposals over line-item quotes.",
];

export interface PersonaTemplate {
  title: string;
  fn: string;
  seniority: string;
  roles: BuyingRole[];
}

export const PERSONAS: PersonaTemplate[] = [
  {
    title: "Chief Information Officer",
    fn: "IT Leadership",
    seniority: "C-Level",
    roles: ["EconomicBuyer"],
  },
  {
    title: "Chief Technology Officer",
    fn: "Technology",
    seniority: "C-Level",
    roles: ["EconomicBuyer", "Influencer"],
  },
  {
    title: "Chief Information Security Officer",
    fn: "Security",
    seniority: "C-Level",
    roles: ["EconomicBuyer", "Influencer", "Blocker"],
  },
  {
    title: "Chief Financial Officer",
    fn: "Finance",
    seniority: "C-Level",
    roles: ["EconomicBuyer", "Blocker"],
  },
  {
    title: "VP, Infrastructure & Operations",
    fn: "Infrastructure",
    seniority: "VP",
    roles: ["Champion", "EconomicBuyer"],
  },
  { title: "VP, Cloud Platform", fn: "Cloud", seniority: "VP", roles: ["Champion", "Influencer"] },
  { title: "VP, Data & Analytics", fn: "Data", seniority: "VP", roles: ["Champion", "Influencer"] },
  {
    title: "Director, Data Center Operations",
    fn: "Infrastructure",
    seniority: "Director",
    roles: ["Technical", "Champion"],
  },
  {
    title: "Director, Enterprise Architecture",
    fn: "Architecture",
    seniority: "Director",
    roles: ["Technical", "Influencer"],
  },
  {
    title: "Director, IT Service Management",
    fn: "Service Management",
    seniority: "Director",
    roles: ["Champion", "Technical"],
  },
  {
    title: "Head of AI Platform",
    fn: "AI / ML",
    seniority: "Director",
    roles: ["Champion", "Technical"],
  },
  {
    title: "Sr. Manager, Network Engineering",
    fn: "Network",
    seniority: "Manager",
    roles: ["Technical"],
  },
  {
    title: "Manager, Security Operations",
    fn: "Security",
    seniority: "Manager",
    roles: ["Technical", "Influencer"],
  },
  {
    title: "Director, IT Procurement",
    fn: "Procurement",
    seniority: "Director",
    roles: ["Blocker", "Influencer"],
  },
];

export function generateContacts(rng: Rng, accountId: string, tier: Tier) {
  const n =
    tier === "Strategic" ? rng.int(6, 10) : tier === "Growth" ? rng.int(4, 7) : rng.int(2, 5);
  // Always include at least one infrastructure persona; sometimes omit an Economic Buyer so gaps exist.
  const chosen = rng.sample(PERSONAS, n);
  const contacts = chosen.map((p, i) => ({
    id: `${accountId}-c${i + 1}`,
    accountId,
    title: p.title,
    function: p.fn,
    seniority: p.seniority,
    buyingRole: rng.pick(p.roles),
    engagement: rng.weighted([
      ["None", 3],
      ["Light", 4],
      ["Engaged", 3],
      ["Strong", 1.5],
    ] as const),
    reportsToId: null as string | null,
  }));
  // Simple hierarchy: non-C-level personas report to a random more-senior persona.
  const rank: Record<string, number> = { "C-Level": 0, VP: 1, Director: 2, Manager: 3, IC: 4 };
  for (const c of contacts) {
    const bosses = contacts.filter((b) => rank[b.seniority] < rank[c.seniority]);
    if (bosses.length) c.reportsToId = rng.pick(bosses).id;
  }
  return contacts;
}

export const INITIATIVE_TEMPLATES: Array<{
  title: string;
  practice: string[];
  description: string;
}> = [
  {
    title: "GPU cluster build-out for model training",
    practice: ["ai-infra", "integration-facility"],
    description: "Standing up dedicated GPU capacity for internal AI workloads.",
  },
  {
    title: "Inference platform for customer-facing AI",
    practice: ["ai-infra", "automation"],
    description: "Production inference serving with strict latency targets.",
  },
  {
    title: "Data center consolidation",
    practice: ["modern-dc", "managed-services"],
    description: "Reducing the physical footprint and exiting a leased facility.",
  },
  {
    title: "Liquid cooling readiness for high-density racks",
    practice: ["modern-dc", "ai-infra"],
    description: "Evaluating direct-to-chip cooling for future rack densities.",
  },
  {
    title: "Cloud cost reduction / FinOps program",
    practice: ["cloud"],
    description: "Executive mandate to reduce cloud spend run-rate.",
  },
  {
    title: "Hybrid cloud landing zone",
    practice: ["cloud", "automation"],
    description: "Standardizing landing zones and guardrails.",
  },
  {
    title: "Zero-trust security roadmap",
    practice: ["security"],
    description: "Multi-year identity-first security program.",
  },
  {
    title: "Ransomware resilience & recovery",
    practice: ["security", "modern-dc"],
    description: "Immutable backups and tested recovery runbooks.",
  },
  {
    title: "ServiceNow ITSM expansion",
    practice: ["esm"],
    description: "Expanding service management beyond IT into HR and facilities.",
  },
  {
    title: "Internal developer platform",
    practice: ["automation", "cloud"],
    description: "Self-service infrastructure for product teams.",
  },
  {
    title: "Enterprise data platform modernization",
    practice: ["data-analytics", "cloud"],
    description: "Consolidating warehouses into a governed lakehouse.",
  },
  {
    title: "Infrastructure operations outsourcing",
    practice: ["managed-services"],
    description: "Shifting day-2 operations to a managed provider.",
  },
];

export const TECH_STACK_TEMPLATES: Array<{
  category: string;
  technology: string;
  evidence: string;
}> = [
  {
    category: "Virtualization",
    technology: "Hypervisor-based private cloud",
    evidence: "Job posts reference virtualization administration",
  },
  {
    category: "Compute",
    technology: "Blade servers nearing end of support",
    evidence: "Hardware refresh referenced in planning documents",
  },
  {
    category: "Storage",
    technology: "Unified SAN/NAS arrays",
    evidence: "Storage engineer postings mention array migration",
  },
  {
    category: "Network",
    technology: "Spine-leaf data center fabric",
    evidence: "Network engineering postings",
  },
  {
    category: "Cloud",
    technology: "Primary hyperscaler (Hyperscaler A)",
    evidence: "Cloud engineer postings and press mentions",
  },
  {
    category: "Cloud",
    technology: "Secondary hyperscaler (Hyperscaler B)",
    evidence: "Multi-cloud references in hiring",
  },
  { category: "Containers", technology: "Kubernetes", evidence: "Platform engineering postings" },
  {
    category: "Automation",
    technology: "Infrastructure as code",
    evidence: "DevOps postings reference IaC pipelines",
  },
  {
    category: "ITSM",
    technology: "Enterprise ITSM platform",
    evidence: "Service management developer postings",
  },
  { category: "Security", technology: "EDR + SIEM stack", evidence: "SOC analyst postings" },
  { category: "Data", technology: "Cloud data warehouse", evidence: "Data engineer postings" },
  {
    category: "AI / ML",
    technology: "GPU-accelerated servers",
    evidence: "HPC/ML engineer postings",
  },
];

export function generatePracticeStatuses(rng: Rng, accountId: string, tier: Tier) {
  const engagedBias = tier === "Strategic" ? 1.6 : tier === "Growth" ? 1 : 0.6;
  return DEFAULT_PRACTICE_AREAS.map((p) => ({
    accountId,
    practiceArea: p.id,
    status: rng.weighted<PracticeStatus>([
      ["NotEngaged", 5],
      ["Exploring", 2 * engagedBias],
      ["ActiveOpp", 1.2 * engagedBias],
      ["Delivered", 1.2 * engagedBias],
    ]),
  }));
}
