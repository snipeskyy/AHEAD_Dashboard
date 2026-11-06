/** Data completeness (pure): weighted share of the fields that matter for the account's tier. */
import type { Tier } from "@/lib/domain/enums";
import { FIELD_DEFS, type FieldDef } from "./fields";

export interface CompletenessInput {
  tier: Tier;
  /** Field ids that currently have a value (AccountField rows or mirrored Account columns). */
  filled: Set<string>;
  contacts: number;
  initiatives: number;
}

export interface Completeness {
  pct: number;
  missing: Array<{ id: string; label: string; weight: number; manual: boolean; prompt?: string }>;
}

/** Non-field signals of a complete account, scored alongside the catalog. */
const EXTRA = [
  {
    id: "x.contacts",
    label: "Buying committee (at least 3 contacts)",
    weight: { Strategic: 3, Growth: 2, Maintain: 1 },
  },
  {
    id: "x.initiatives",
    label: "Strategic initiatives with evidence",
    weight: { Strategic: 3, Growth: 2, Maintain: 1 },
  },
] as const;

export function completeness(
  input: CompletenessInput,
  defs: FieldDef[] = FIELD_DEFS,
): Completeness {
  let have = 0;
  let total = 0;
  const missing: Completeness["missing"] = [];
  for (const d of defs) {
    const wt = d.weight[input.tier];
    if (!wt) continue;
    total += wt;
    if (input.filled.has(d.id)) have += wt;
    else
      missing.push({ id: d.id, label: d.label, weight: wt, manual: !!d.manual, prompt: d.prompt });
  }
  const extras: Record<string, boolean> = {
    "x.contacts": input.contacts >= 3,
    "x.initiatives": input.initiatives > 0,
  };
  for (const e of EXTRA) {
    const wt = e.weight[input.tier];
    total += wt;
    if (extras[e.id]) have += wt;
    else missing.push({ id: e.id, label: e.label, weight: wt, manual: e.id === "x.contacts" });
  }
  missing.sort((a, b) => b.weight - a.weight);
  return { pct: total ? Math.round((have / total) * 100) : 0, missing };
}
