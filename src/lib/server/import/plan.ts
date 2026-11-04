import "server-only";
import { db } from "@/lib/db";
import { KIND_DEFS } from "@/lib/import/kinds";
import type { AccountImportValue } from "@/lib/import/kinds/accounts";
import type { ContactImportValue } from "@/lib/import/kinds/contacts";
import type { NoteImportValue } from "@/lib/import/kinds/notes";
import type { OppImportValue } from "@/lib/import/kinds/opportunities";
import type { PartnerRepImportValue } from "@/lib/import/kinds/partner-reps";
import type { ImportKind, MappedRow, RowIssue } from "@/lib/import/types";
import { normalizeLegalName } from "@/lib/import/values";
import { buildAccountIndex } from "./account-index";
import { diffFields } from "./diff";

export type Decision = "create" | "merge" | "skip";

export interface PreviewRow {
  index: number;
  status: "new" | "duplicate" | "error";
  label: string;
  errors: RowIssue[];
  warnings: string[];
  accountId?: string;
  accountName?: string;
  match?: { id: string; name: string; by: "domain" | "name" | "file" | "key" };
  diff: Array<{ field: string; label: string; current: string; incoming: string }>;
  defaultDecision: Decision;
  /** Decisions that make sense for this row (notes can't merge, file duplicates can't merge). */
  options: Decision[];
}

export interface PlanItem {
  row: PreviewRow;
  value: unknown;
  /** Resolved account ids for partner-rep coverage. */
  accountIds?: string[];
}

const NEW: Decision[] = ["create", "skip"];
const DUP: Decision[] = ["merge", "skip", "create"];

/** Validates, resolves account references, finds duplicates and diffs. Pure read; no writes. */
export async function planImport(kind: ImportKind, rows: MappedRow[]): Promise<PlanItem[]> {
  const def = KIND_DEFS[kind];
  const idx = await buildAccountIndex();
  const seen = new Map<string, number>(); // in-file dedupe key → first row index
  const existing = await existingFor(kind);
  const out: PlanItem[] = [];

  for (const [i, raw] of rows.entries()) {
    const r = def.normalize(raw);
    const base: PreviewRow = {
      index: i,
      status: "new",
      label: raw.name || raw.title || raw.account || `Row ${i + 1}`,
      errors: [],
      warnings: [],
      diff: [],
      defaultDecision: "create",
      options: NEW,
    };
    if (!r.ok) {
      out.push({
        row: {
          ...base,
          status: "error",
          errors: r.errors,
          defaultDecision: "skip",
          options: ["skip"],
        },
        value: null,
      });
      continue;
    }
    const v = r.value as Record<string, unknown>;
    let accountId: string | undefined;
    if (kind !== "accounts" && kind !== "partner-reps") {
      const acc = idx.resolve(String(v.account));
      if (!acc) {
        out.push({
          row: {
            ...base,
            status: "error",
            errors: [
              { field: "account", message: `No account matches "${v.account}". Import it first.` },
            ],
            defaultDecision: "skip",
            options: ["skip"],
          },
          value: null,
        });
        continue;
      }
      accountId = acc.id;
      base.accountId = acc.id;
      base.accountName = acc.name;
    }

    const key = dedupeKey(kind, v, accountId);
    const label = labelFor(kind, v);
    if (seen.has(key)) {
      out.push({
        row: {
          ...base,
          label,
          status: "duplicate",
          match: { id: "", name: `row ${seen.get(key)! + 1} of this file`, by: "file" },
          defaultDecision: "skip",
          options: ["skip", "create"],
        },
        value: v,
      });
      continue;
    }
    seen.set(key, i);

    const hit =
      kind === "accounts"
        ? matchAccount(idx, v as unknown as AccountImportValue)
        : existing.get(key);
    let accountIds: string[] | undefined;
    if (kind === "partner-reps") {
      const refs = (v as unknown as PartnerRepImportValue).accounts;
      const resolved = refs.map((ref) => [ref, idx.resolve(ref)] as const);
      accountIds = resolved.flatMap(([, a]) => (a ? [a.id] : []));
      for (const [ref, a] of resolved)
        if (!a) base.warnings.push(`No account matches "${ref}" (skipped)`);
    }
    if (!hit) {
      out.push({ row: { ...base, label }, value: v, accountIds });
      continue;
    }
    const diff = await diffFields(kind, hit.id, v, accountIds);
    const mergeable = kind !== "notes";
    out.push({
      row: {
        ...base,
        label,
        status: "duplicate",
        match: { id: hit.id, name: hit.name, by: hit.by },
        diff,
        defaultDecision: mergeable && diff.length ? "merge" : "skip",
        options: mergeable ? DUP : ["skip", "create"],
      },
      value: v,
      accountIds,
    });
  }
  return out;
}

function matchAccount(idx: Awaited<ReturnType<typeof buildAccountIndex>>, v: AccountImportValue) {
  const m = idx.match(v.name, v.domain);
  return m ? { id: m.account.id, name: m.account.name, by: m.by } : null;
}

const lc = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

function dedupeKey(kind: ImportKind, v: Record<string, unknown>, accountId?: string) {
  switch (kind) {
    case "accounts": {
      const a = v as unknown as AccountImportValue;
      return a.domain ? `d:${a.domain}` : `n:${normalizeLegalName(a.name)}`;
    }
    case "contacts": {
      const c = v as unknown as ContactImportValue;
      return `${accountId}|${lc(c.displayName)}|${lc(c.title)}`;
    }
    case "opportunities":
      return `${accountId}|${normalizeLegalName(String((v as unknown as OppImportValue).name))}`;
    case "notes":
      return `${accountId}|${lc((v as unknown as NoteImportValue).body)}`;
    case "partner-reps": {
      const p = v as unknown as PartnerRepImportValue;
      return `${lc(p.partnerCompany)}|${lc(p.name)}`;
    }
  }
}

function labelFor(kind: ImportKind, v: Record<string, unknown>) {
  if (kind === "contacts") {
    const c = v as unknown as ContactImportValue;
    return c.displayName ? `${c.displayName}, ${c.title}` : c.title;
  }
  if (kind === "notes") return String((v as unknown as NoteImportValue).body).slice(0, 80);
  if (kind === "partner-reps") {
    const p = v as unknown as PartnerRepImportValue;
    return `${p.name} (${p.partnerCompany})`;
  }
  return String(v.name);
}

/** Existing child records keyed like dedupeKey, for duplicate detection. */
async function existingFor(kind: ImportKind) {
  const m = new Map<string, { id: string; name: string; by: "key" }>();
  if (kind === "contacts")
    for (const c of await db.contact.findMany({
      select: { id: true, accountId: true, displayName: true, title: true },
    }))
      m.set(`${c.accountId}|${lc(c.displayName)}|${lc(c.title)}`, {
        id: c.id,
        name: c.displayName ? `${c.displayName}, ${c.title}` : c.title,
        by: "key",
      });
  if (kind === "opportunities")
    for (const o of await db.opportunity.findMany({
      select: { id: true, accountId: true, name: true },
    }))
      m.set(`${o.accountId}|${normalizeLegalName(o.name)}`, { id: o.id, name: o.name, by: "key" });
  if (kind === "notes")
    for (const n of await db.note.findMany({
      where: { entityType: "account" },
      select: { id: true, entityId: true, body: true },
    }))
      m.set(`${n.entityId}|${lc(n.body)}`, { id: n.id, name: "an identical note", by: "key" });
  if (kind === "partner-reps")
    for (const p of await db.partnerRep.findMany({
      select: { id: true, partnerCompany: true, name: true },
    }))
      m.set(`${lc(p.partnerCompany)}|${lc(p.name)}`, {
        id: p.id,
        name: `${p.name} (${p.partnerCompany})`,
        by: "key",
      });
  return m;
}
