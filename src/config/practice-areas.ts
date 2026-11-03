/**
 * Default practice-area taxonomy. Users can edit labels/keywords in Settings
 * (stored in the Setting table under "taxonomy.practiceAreas"); these are the defaults.
 */
export interface PracticeArea {
  id: string;
  label: string;
  short: string;
  description: string;
}

export const DEFAULT_PRACTICE_AREAS: PracticeArea[] = [
  {
    id: "ai-infra",
    label: "AI Infrastructure",
    short: "AI Infra",
    description: "GPU clusters, AI factories, inference platforms",
  },
  {
    id: "modern-dc",
    label: "Modern Data Center",
    short: "Data Center",
    description: "Compute, storage, network, consolidation, cooling",
  },
  {
    id: "cloud",
    label: "Cloud",
    short: "Cloud",
    description: "Migration, landing zones, FinOps, hybrid cloud",
  },
  {
    id: "data-analytics",
    label: "Data & Analytics",
    short: "Data",
    description: "Data platforms, governance, analytics",
  },
  {
    id: "security",
    label: "Security",
    short: "Security",
    description: "Zero trust, resilience, SecOps",
  },
  {
    id: "automation",
    label: "Automation & Platform Engineering",
    short: "Platform Eng",
    description: "IaC, DevOps, internal developer platforms",
  },
  {
    id: "esm",
    label: "Enterprise Service Management",
    short: "ESM",
    description: "ServiceNow, ITSM, workflow",
  },
  {
    id: "managed-services",
    label: "Managed Services",
    short: "Managed",
    description: "Ongoing operations and support",
  },
  {
    id: "integration-facility",
    label: "Integration Facility",
    short: "Integration",
    description: "Pre-integrated, tested rack delivery",
  },
];

export const PRACTICE_AREA_IDS = DEFAULT_PRACTICE_AREAS.map((p) => p.id);

export function practiceLabel(id: string, short = false): string {
  const p = DEFAULT_PRACTICE_AREAS.find((x) => x.id === id);
  if (!p) return id;
  return short ? p.short : p.label;
}
