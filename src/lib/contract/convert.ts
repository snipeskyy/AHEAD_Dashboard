import type { MappedRow } from "@/lib/import/types";
import { INTERNAL_FIELDS, type AccountRef, type Contract } from "./schema";

/**
 * Pure helpers between the contract format and ACC's import rows (field ids of src/lib/import/kinds/*).
 * Import goes through the same pipeline as CSV (validate → dedupe → diff → commit → undo).
 */

/** Turns an account reference into the string the import index resolves (domain first, then name). */
export type RefResolver = (ref: AccountRef) => string | null;

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const day = (v: string | undefined) => (v ? v.slice(0, 10) : "");

/**
 * Resolver over the file's own accounts plus already-known external ids.
 * `known` maps an external account id (scoped to the sending system) to that account's domain or name in ACC.
 */
export function makeResolver(c: Contract, known: Map<string, string>): RefResolver {
  const inFile = new Map<string, string>();
  for (const a of c.entities.accounts)
    if (a.externalId) inFile.set(a.externalId, a.domain || a.name);
  return (ref) => {
    if (ref.externalId) {
      const hit = inFile.get(ref.externalId) ?? known.get(ref.externalId);
      if (hit) return hit;
    }
    return ref.domain || ref.name || null;
  };
}

/** Unresolvable refs become a row error in the pipeline ("No account matches …"). */
const refCell = (resolve: RefResolver, ref: AccountRef) =>
  resolve(ref) ?? `unknown account ${ref.externalId ?? ""}`.trim();

export const accountRows = (c: Contract): MappedRow[] =>
  c.entities.accounts.map((a) => ({
    name: a.name,
    domain: str(a.domain),
    ticker: str(a.ticker),
    industry: str(a.industry),
    subIndustry: str(a.subIndustry),
    hq: str(a.hq),
    tier: str(a.tier),
    employeeBand: str(a.employeeBand),
    revenueBand: str(a.revenueBand),
    ownerNotes: str(a.ownerNotes),
  }));

export const contactRows = (c: Contract, r: RefResolver): MappedRow[] =>
  c.entities.contacts.map((x) => ({
    account: refCell(r, x.account),
    displayName: str(x.displayName),
    title: x.title,
    function: str(x.function),
    seniority: str(x.seniority),
    buyingRole: str(x.buyingRole),
    engagement: str(x.engagement),
  }));

/** `amount` blank when the file omits it; the importer fills in the current amount for matched deals. */
export const opportunityRows = (c: Contract, r: RefResolver): MappedRow[] =>
  c.entities.opportunities.map((o) => ({
    account: refCell(r, o.account),
    name: o.name,
    practiceArea: o.practiceArea,
    stage: o.stage,
    amount: str(o.amount),
    closeDate: day(o.closeDate),
    probability: str(o.probability),
    nextStep: str(o.nextStep),
  }));

export const noteRows = (c: Contract, r: RefResolver): MappedRow[] =>
  c.entities.notes.map((n) => ({
    account: refCell(r, n.account),
    body: n.body,
    date: day(n.date),
  }));

export const partnerRepRows = (c: Contract, r: RefResolver): MappedRow[] =>
  c.entities.partnerReps.map((p) => ({
    partnerCompany: p.partnerCompany,
    name: p.name,
    title: str(p.title),
    territory: str(p.territory),
    accounts: p.accounts.map((a) => refCell(r, a)).join("; "),
  }));

/** Customer-safe contract: drops fields described "internal", all notes, and anything the role hides. */
export function redactContract(
  c: Contract,
  opts: { visibility: Contract["visibility"]; hidden: ReadonlySet<string> },
): Contract {
  const drop: Record<string, Set<string>> = {
    accounts: new Set(opts.visibility === "customer-safe" ? INTERNAL_FIELDS.accounts : []),
    opportunities: new Set(
      opts.visibility === "customer-safe" ? INTERNAL_FIELDS.opportunities : [],
    ),
  };
  if (opts.hidden.has("opp.amount")) drop.opportunities.add("amount");
  if (opts.hidden.has("opp.forecast")) drop.opportunities.add("probability");
  const strip = <T extends object>(rows: T[], keys: Set<string> | undefined): T[] =>
    keys?.size
      ? rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !keys.has(k))) as T)
      : rows;
  const noNotes = opts.visibility === "customer-safe" || opts.hidden.has("notes");
  if (noNotes) drop.accounts.add("ownerNotes");
  return {
    ...c,
    visibility: opts.visibility,
    entities: {
      ...c.entities,
      accounts: strip(c.entities.accounts, drop.accounts),
      opportunities: strip(c.entities.opportunities, drop.opportunities),
      notes: noNotes ? [] : c.entities.notes,
    },
  };
}

/** Customer-safe files must not carry internal fields; checked on import as well (a mislabeled file is refused). */
export function internalFieldsPresent(c: Contract): string[] {
  const out: string[] = [];
  for (const [k, fields] of Object.entries(INTERNAL_FIELDS) as Array<
    [keyof Contract["entities"], string[]]
  >)
    for (const row of c.entities[k] as object[])
      for (const f of fields)
        if (f in row && (row as Record<string, unknown>)[f] !== undefined) out.push(`${k}.${f}`);
  if (c.entities.notes.length) out.push("notes");
  return [...new Set(out)];
}
