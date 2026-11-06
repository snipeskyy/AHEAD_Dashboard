/**
 * Catalog of enrichable account fields (pure). Every value enrichment can fill is listed here with its
 * section, how it mirrors onto an Account column, and how much it matters per tier (completeness).
 */
import type { Tier } from "@/lib/domain/enums";

export type FieldKind = "text" | "number" | "url" | "money" | "year" | "json";
export type FieldSection =
  "identity" | "firmographics" | "financials" | "web" | "network" | "public-sector" | "manual";

export interface FieldDef {
  id: string;
  label: string;
  section: FieldSection;
  kind: FieldKind;
  /** Account column kept in sync when this field changes (so scores, filters and exports see it). */
  column?:
    | "industry"
    | "hq"
    | "employeeBand"
    | "revenueBand"
    | "cik"
    | "ticker"
    | "lei"
    | "wikidataId"
    | "fiscalYearEnd"
    | "domain";
  /** Importance 0–3 per tier for the completeness score. */
  weight: Record<Tier, number>;
  /** Only the user can fill this (no public source); listed in "Add what only you know". */
  manual?: boolean;
  prompt?: string;
}

const w = (s: number, g: number, m: number): Record<Tier, number> => ({
  Strategic: s,
  Growth: g,
  Maintain: m,
});

export const FIELD_DEFS: FieldDef[] = [
  {
    id: "identity.legalName",
    label: "Legal name",
    section: "identity",
    kind: "text",
    weight: w(2, 1, 1),
  },
  {
    id: "identity.ticker",
    label: "Ticker",
    section: "identity",
    kind: "text",
    column: "ticker",
    weight: w(1, 1, 0),
  },
  {
    id: "identity.cik",
    label: "SEC CIK",
    section: "identity",
    kind: "text",
    column: "cik",
    weight: w(1, 1, 0),
  },
  {
    id: "identity.lei",
    label: "LEI",
    section: "identity",
    kind: "text",
    column: "lei",
    weight: w(1, 0, 0),
  },
  {
    id: "identity.wikidataId",
    label: "Wikidata ID",
    section: "identity",
    kind: "text",
    column: "wikidataId",
    weight: w(0, 0, 0),
  },
  {
    id: "firmographics.description",
    label: "Description",
    section: "firmographics",
    kind: "text",
    weight: w(2, 2, 1),
  },
  {
    id: "firmographics.industry",
    label: "Industry",
    section: "firmographics",
    kind: "text",
    column: "industry",
    weight: w(2, 2, 2),
  },
  {
    id: "firmographics.sic",
    label: "SIC industry",
    section: "firmographics",
    kind: "text",
    weight: w(1, 1, 0),
  },
  {
    id: "firmographics.hqAddress",
    label: "Headquarters",
    section: "firmographics",
    kind: "text",
    column: "hq",
    weight: w(2, 2, 1),
  },
  {
    id: "firmographics.founded",
    label: "Founded",
    section: "firmographics",
    kind: "year",
    weight: w(1, 0, 0),
  },
  {
    id: "firmographics.employeeCount",
    label: "Employees",
    section: "firmographics",
    kind: "number",
    column: "employeeBand",
    weight: w(2, 2, 1),
  },
  {
    id: "firmographics.revenue",
    label: "Revenue (latest FY)",
    section: "firmographics",
    kind: "money",
    column: "revenueBand",
    weight: w(2, 2, 1),
  },
  {
    id: "firmographics.website",
    label: "Website",
    section: "firmographics",
    kind: "url",
    column: "domain",
    weight: w(2, 2, 2),
  },
  {
    id: "firmographics.ceo",
    label: "CEO",
    section: "firmographics",
    kind: "text",
    weight: w(1, 1, 0),
  },
  {
    id: "financials.fiscalYearEnd",
    label: "Fiscal year end",
    section: "financials",
    kind: "text",
    column: "fiscalYearEnd",
    weight: w(3, 2, 1),
  },
  {
    id: "financials.capex",
    label: "Capex (latest FY)",
    section: "financials",
    kind: "money",
    weight: w(2, 1, 0),
  },
  {
    id: "financials.netIncome",
    label: "Net income (latest FY)",
    section: "financials",
    kind: "money",
    weight: w(1, 1, 0),
  },
  { id: "web.careersUrl", label: "Careers page", section: "web", kind: "url", weight: w(1, 1, 0) },
  { id: "web.newsroomUrl", label: "Newsroom", section: "web", kind: "url", weight: w(1, 1, 0) },
  {
    id: "web.investorUrl",
    label: "Investor relations",
    section: "web",
    kind: "url",
    weight: w(1, 0, 0),
  },
  {
    id: "web.newsroomRss",
    label: "Newsroom RSS feed",
    section: "web",
    kind: "url",
    weight: w(1, 1, 0),
  },
  { id: "web.jobBoard", label: "Job board", section: "web", kind: "json", weight: w(1, 1, 0) },
  {
    id: "web.social",
    label: "Company social profiles",
    section: "web",
    kind: "json",
    weight: w(0, 0, 0),
  },
  {
    id: "hiring.snapshot",
    label: "Open roles (public job board)",
    section: "web",
    kind: "json",
    weight: w(1, 1, 0),
  },
  {
    id: "network.peering",
    label: "Network / data center presence",
    section: "network",
    kind: "json",
    weight: w(0, 0, 0),
  },
  {
    id: "public.federalAwards",
    label: "Federal awards",
    section: "public-sector",
    kind: "json",
    weight: w(0, 0, 0),
  },
  {
    id: "manual.infraVendors",
    label: "Current infrastructure vendors",
    section: "manual",
    kind: "text",
    manual: true,
    weight: w(3, 2, 1),
    prompt: "Which compute, storage, network and cloud vendors are in place today?",
  },
  {
    id: "manual.budgetCycle",
    label: "Budget cycle notes",
    section: "manual",
    kind: "text",
    manual: true,
    weight: w(3, 2, 1),
    prompt: "When do they plan budgets, and who signs off?",
  },
  {
    id: "manual.keyRelationships",
    label: "Key relationships",
    section: "manual",
    kind: "text",
    manual: true,
    weight: w(3, 2, 1),
    prompt: "Who do you know there, and how strong is each relationship?",
  },
  {
    id: "manual.strategicPriorities",
    label: "Stated priorities (from meetings)",
    section: "manual",
    kind: "text",
    manual: true,
    weight: w(2, 1, 0),
    prompt: "What have they told you matters most this year?",
  },
  {
    id: "manual.competitivePosition",
    label: "Competitive position",
    section: "manual",
    kind: "text",
    manual: true,
    weight: w(2, 1, 0),
    prompt: "Which other providers are engaged, and where do we stand?",
  },
];

export const FIELD_BY_ID = new Map(FIELD_DEFS.map((f) => [f.id, f]));
export const SECTION_LABELS: Record<FieldSection, string> = {
  identity: "Identity",
  firmographics: "Firmographics",
  financials: "Financials",
  web: "Web presence",
  network: "Network",
  "public-sector": "Public sector",
  manual: "Only you know",
};

/** List-type proposals (accepted into their own tables, never auto-applied). Field id prefix → kind. */
export const LIST_PREFIXES = {
  "evidence.initiative:": "initiative",
  "tech:": "tech",
  "contact:": "contact",
} as const;
export function listKind(field: string) {
  for (const [p, k] of Object.entries(LIST_PREFIXES)) if (field.startsWith(p)) return k;
  return null;
}

export function employeeBand(n: number) {
  if (n < 1000) return "<1k";
  if (n < 5000) return "1k–5k";
  if (n < 10_000) return "5k–10k";
  if (n < 25_000) return "10k–25k";
  if (n < 50_000) return "25k–50k";
  return "50k+";
}

export function revenueBand(usd: number) {
  if (usd < 500e6) return "<$500M";
  if (usd < 1e9) return "$500M–$1B";
  if (usd < 5e9) return "$1B–$5B";
  if (usd < 10e9) return "$5B–$10B";
  if (usd < 25e9) return "$10B–$25B";
  return "$25B+";
}

/** Value written to the mirrored Account column, or undefined when the field has no column. */
export function columnValue(def: FieldDef, value: unknown): string | null | undefined {
  if (!def.column) return undefined;
  if (value === null || value === undefined || value === "") return null;
  if (def.column === "employeeBand") return employeeBand(Number(value));
  if (def.column === "revenueBand") return revenueBand(Number(value));
  if (def.column === "hq" && typeof value === "object") {
    const a = value as { city?: string; region?: string; country?: string };
    return [a.city, a.region ?? a.country].filter(Boolean).join(", ") || null;
  }
  if (def.column === "domain") {
    const s = String(value)
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, "")
      .replace(/^www\./, "");
    return s.split(/[/?#]/)[0] || null;
  }
  return String(value);
}

/** Human display of a stored value. */
export function displayValue(field: string, value: unknown): string {
  const def = FIELD_BY_ID.get(field);
  if (value === null || value === undefined || value === "") return "—";
  if (def?.kind === "money") return formatMoney(Number(value));
  if (def?.kind === "number") return Number(value).toLocaleString("en-US");
  if (field === "firmographics.hqAddress" && typeof value === "object") {
    const a = value as {
      lines?: string[];
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
    };
    return [
      ...(a.lines ?? []),
      [a.city, a.region, a.postalCode].filter(Boolean).join(" "),
      a.country,
    ]
      .filter(Boolean)
      .join(", ");
  }
  if (field === "financials.fiscalYearEnd" && /^\d{4}$/.test(String(value))) {
    const s = String(value);
    return new Date(
      Date.UTC(2000, Number(s.slice(0, 2)) - 1, Number(s.slice(2))),
    ).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  }
  if (field === "hiring.snapshot" && typeof value === "object") {
    const h = value as { total: number; asOf: string };
    return `${h.total} open roles (as of ${h.asOf})`;
  }
  if (field === "web.jobBoard" && typeof value === "object") {
    const j = value as { provider: string; slug: string };
    return `${j.provider} · ${j.slug}`;
  }
  if (typeof value === "object")
    return Array.isArray(value)
      ? value.join(", ")
      : summarizeObject(value as Record<string, unknown>);
  return String(value);
}

function summarizeObject(o: Record<string, unknown>) {
  return Object.entries(o)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");
}

export function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const s =
    a >= 1e9
      ? `$${(a / 1e9).toFixed(1)}B`
      : a >= 1e6
        ? `$${(a / 1e6).toFixed(1)}M`
        : `$${Math.round(a).toLocaleString("en-US")}`;
  return n < 0 ? `−${s}` : s;
}
