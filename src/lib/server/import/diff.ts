import "server-only";
import { practiceLabel } from "@/config/practice-areas";
import { db } from "@/lib/db";
import { STAGE_LABELS, type Stage } from "@/lib/domain/enums";
import type { ImportKind } from "@/lib/import/types";

type Fmt = (v: unknown) => string;

/** Fields a merge may change, per kind: [field, label, formatter]. */
const FIELDS: Record<ImportKind, Array<[string, string, Fmt?]>> = {
  accounts: [
    ["domain", "Domain"],
    ["ticker", "Ticker"],
    ["industry", "Industry"],
    ["subIndustry", "Sub-industry"],
    ["hq", "HQ"],
    ["tier", "Tier"],
    ["employeeBand", "Employees"],
    ["revenueBand", "Revenue"],
    ["ownerNotes", "Notes"],
  ],
  contacts: [
    ["displayName", "Name"],
    ["title", "Title"],
    ["function", "Function"],
    ["seniority", "Seniority"],
    ["buyingRole", "Buying role"],
    ["engagement", "Engagement"],
  ],
  opportunities: [
    ["practiceArea", "Practice", (v) => practiceLabel(String(v))],
    ["stage", "Stage", (v) => STAGE_LABELS[v as Stage] ?? String(v)],
    ["amount", "Amount", (v) => `$${Math.round(Number(v)).toLocaleString("en-US")}`],
    ["closeDate", "Close date", (v) => toDate(v).toISOString().slice(0, 10)],
    ["probability", "Probability", (v) => `${v}%`],
    ["nextStep", "Next step"],
  ],
  notes: [],
  "partner-reps": [
    ["title", "Title"],
    ["territory", "Territory"],
    ["notes", "Notes"],
  ],
};

const toDate = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));
const empty = (v: unknown) => v === null || v === undefined || v === "";
const same = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date
    ? !empty(a) && !empty(b) && toDate(a).getTime() === toDate(b).getTime()
    : String(a ?? "") === String(b ?? "");

async function load(kind: ImportKind, id: string): Promise<Record<string, unknown> | null> {
  switch (kind) {
    case "accounts":
      return db.account.findUnique({ where: { id } });
    case "contacts":
      return db.contact.findUnique({ where: { id } });
    case "opportunities":
      return db.opportunity.findUnique({ where: { id } });
    case "partner-reps":
      return db.partnerRep.findUnique({ where: { id }, include: { accounts: true } });
    case "notes":
      return db.note.findUnique({ where: { id } });
  }
}

export interface FieldDiff {
  field: string;
  label: string;
  current: string;
  incoming: string;
}

/**
 * What a merge would change: only fields where the import has a value that differs.
 * Blank cells never erase existing data.
 */
export async function mergePlan(
  kind: ImportKind,
  id: string,
  incoming: Record<string, unknown>,
  accountIds?: string[],
) {
  const current = await load(kind, id);
  const patch: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  const diff: FieldDiff[] = [];
  let addLinks: string[] = [];
  if (!current) return { patch, before, diff, addLinks };
  for (const [field, label, fmt = (v: unknown) => String(v)] of FIELDS[kind]) {
    const next = incoming[field];
    if (empty(next) || same(current[field], next)) continue;
    patch[field] = next;
    before[field] = current[field] ?? null;
    diff.push({
      field,
      label,
      current: empty(current[field]) ? "—" : fmt(current[field]),
      incoming: fmt(next),
    });
  }
  if (kind === "partner-reps" && accountIds?.length) {
    const have = new Set(
      (current.accounts as Array<{ accountId: string }>).map((l) => l.accountId),
    );
    addLinks = accountIds.filter((a) => !have.has(a));
    if (addLinks.length)
      diff.push({
        field: "accounts",
        label: "Accounts covered",
        current: `${have.size}`,
        incoming: `+${addLinks.length}`,
      });
  }
  return { patch, before, diff, addLinks };
}

export async function diffFields(
  kind: ImportKind,
  id: string,
  incoming: Record<string, unknown>,
  accountIds?: string[],
) {
  return (await mergePlan(kind, id, incoming, accountIds)).diff;
}
