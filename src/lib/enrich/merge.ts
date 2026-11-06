/**
 * Merge policy (pure). Precedence: user-entered > user-verified > high-confidence public > medium > low.
 * - A field the user edited is locked: enrichment never overwrites it; a newer public value becomes a hint.
 * - High-confidence values may fill an EMPTY (or lower-precedence) field automatically when auto-apply is on.
 * - Everything else waits for review. Conflicting proposals are all kept for the user to pick.
 * - List-type evidence (initiatives, tech, contacts) is always reviewed, never auto-applied.
 */
import { listKind } from "./fields";

export type Confidence = "user" | "verified" | "high" | "medium" | "low";
export const RANK: Record<Confidence, number> = {
  user: 5,
  verified: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export interface CurrentValue {
  value: unknown;
  confidence: Confidence;
  locked: boolean;
}

export interface Incoming {
  field: string;
  value: unknown;
  confidence: "high" | "medium" | "low";
}

/** apply: write it now · review: pending proposal · same: already the current value · locked-hint: pending, shown as "newer public value available" */
export type Decision = "apply" | "review" | "same" | "locked-hint";

export function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown =>
    typeof v === "string"
      ? v.trim().toLowerCase().replace(/\/+$/, "")
      : Array.isArray(v)
        ? v.map(norm)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v as object)
                .sort(([x], [y]) => x.localeCompare(y))
                .map(([k, x]) => [k, norm(x)]),
            )
          : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function decide(
  current: CurrentValue | null,
  p: Incoming,
  opts: { autoApply: boolean },
): Decision {
  if (current && sameValue(current.value, p.value)) return "same";
  if (listKind(p.field)) return "review";
  if (current?.locked) return "locked-hint";
  const canAuto = opts.autoApply && p.confidence === "high";
  if (!current) return canAuto ? "apply" : "review";
  return canAuto && RANK[p.confidence] > RANK[current.confidence] ? "apply" : "review";
}

/** Groups pending proposals by field; >1 distinct value for a field is a conflict the user resolves. */
export function groupConflicts<T extends { field: string; value: unknown }>(items: T[]) {
  const by = new Map<string, T[]>();
  for (const it of items) by.set(it.field, [...(by.get(it.field) ?? []), it]);
  return [...by.entries()].map(([field, list]) => {
    const distinct: T[] = [];
    for (const x of list) if (!distinct.some((d) => sameValue(d.value, x.value))) distinct.push(x);
    return { field, items: list, conflict: distinct.length > 1 };
  });
}
