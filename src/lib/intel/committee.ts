import { BUYING_ROLE_LABELS, type BuyingRole } from "@/lib/domain/enums";

export interface PersonaLite {
  id: string;
  title: string;
  seniority: string;
  buyingRole: string;
  engagement: string;
  reportsToId: string | null;
}

export interface CoverageGap {
  severity: "critical" | "warning";
  message: string;
  role?: BuyingRole;
}

const CORE: BuyingRole[] = ["EconomicBuyer", "Champion", "Technical", "Influencer"];

/** Buying-committee coverage gaps, most severe first. */
export function committeeGaps(personas: PersonaLite[]): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const role of CORE) {
    const people = personas.filter((p) => p.buyingRole === role);
    if (!people.length)
      gaps.push({
        severity: role === "EconomicBuyer" || role === "Champion" ? "critical" : "warning",
        message: `No ${BUYING_ROLE_LABELS[role]} identified`,
        role,
      });
    else if (people.every((p) => p.engagement === "None"))
      gaps.push({
        severity: "warning",
        message: `${BUYING_ROLE_LABELS[role]} identified but not engaged`,
        role,
      });
  }
  if (!personas.some((p) => p.seniority === "C-Level"))
    gaps.push({ severity: "warning", message: "No C-level relationship mapped" });
  const blockers = personas.filter((p) => p.buyingRole === "Blocker" && p.engagement === "None");
  if (blockers.length)
    gaps.push({
      severity: "warning",
      message: `${blockers.length} potential blocker${blockers.length > 1 ? "s" : ""} not engaged`,
      role: "Blocker",
    });
  return gaps.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}

export interface OrgNode<T extends PersonaLite = PersonaLite> {
  persona: T;
  children: OrgNode<T>[];
}

/** Builds a forest from reportsToId; breaks cycles and dangling references by promoting to root. */
export function buildOrgTree<T extends PersonaLite>(personas: T[]): OrgNode<T>[] {
  const byId = new Map(personas.map((p) => [p.id, { persona: p, children: [] as OrgNode<T>[] }]));
  const roots: OrgNode<T>[] = [];
  const rank: Record<string, number> = { "C-Level": 0, VP: 1, Director: 2, Manager: 3, IC: 4 };
  for (const node of byId.values()) {
    let parentId = node.persona.reportsToId;
    // Cycle guard: walk up; if we come back to ourselves, treat as root.
    const seen = new Set([node.persona.id]);
    let cur = parentId;
    while (cur && byId.has(cur)) {
      if (seen.has(cur)) {
        parentId = null;
        break;
      }
      seen.add(cur);
      cur = byId.get(cur)!.persona.reportsToId;
    }
    const parent = parentId ? byId.get(parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sort = (xs: OrgNode<T>[]) => {
    xs.sort(
      (a, b) =>
        (rank[a.persona.seniority] ?? 9) - (rank[b.persona.seniority] ?? 9) ||
        a.persona.title.localeCompare(b.persona.title),
    );
    xs.forEach((x) => sort(x.children));
  };
  sort(roots);
  return roots;
}
