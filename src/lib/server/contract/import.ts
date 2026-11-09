import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import {
  accountRows,
  contactRows,
  makeResolver,
  noteRows,
  opportunityRows,
  partnerRepRows,
} from "@/lib/contract/convert";
import type { Contract } from "@/lib/contract/schema";
import type { ImportKind, MappedRow } from "@/lib/import/types";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { logActivity } from "../activity";
import { buildAccountIndex } from "../import/account-index";
import { commitImport } from "../import/commit";
import { planImport, type PlanItem } from "../import/plan";
import { updateOpportunity } from "../opportunities";
import { applyChildren, planChildren } from "./activities";
import { knownAccountRefs, upsertRef, type RefEntity } from "./refs";

type Step = {
  key: keyof Contract["entities"];
  kind: ImportKind;
  entity: RefEntity;
  rows: (c: Contract, r: ReturnType<typeof makeResolver>) => MappedRow[];
};
const STEPS: Step[] = [
  { key: "accounts", kind: "accounts", entity: "account", rows: (c) => accountRows(c) },
  { key: "contacts", kind: "contacts", entity: "contact", rows: contactRows },
  { key: "opportunities", kind: "opportunities", entity: "opportunity", rows: opportunityRows },
  { key: "notes", kind: "notes", entity: "note", rows: noteRows },
  { key: "partnerReps", kind: "partner-reps", entity: "partner-rep", rows: partnerRepRows },
];

export interface EntityPreview {
  key: string;
  total: number;
  create: number;
  merge: number;
  unchanged: number;
  errors: Array<{ label: string; message: string }>;
  /** Phase 15: what each row would do, for review (first 50 per entity). */
  changes: Array<{
    label: string;
    action: "create" | "merge";
    diff: Array<{ label: string; current: string; incoming: string }>;
  }>;
}

const lc = (s: string) => s.trim().toLowerCase();

/** Account refs that point at accounts this file will create (they don't exist yet at preview time). */
const pendingAccounts = (c: Contract, plan: PlanItem[]) =>
  new Set(
    plan
      .filter((p) => p.row.status === "new")
      .flatMap((p) => {
        const a = c.entities.accounts[p.row.index];
        return [lc(a.name), ...(a.domain ? [lc(a.domain)] : [])];
      }),
  );

/** Opportunities without an amount (customer-safe or role-redacted files) keep the matched deal's amount. */
async function fillAmounts(rows: MappedRow[]) {
  if (!rows.some((r) => !r.amount)) return rows;
  const plan = await planImport(
    "opportunities",
    rows.map((r) => ({ ...r, amount: r.amount || "0" })),
  );
  const ids = plan.flatMap((p) => (p.row.match?.id ? [p.row.match.id] : []));
  const amounts = new Map(
    (
      await db.opportunity.findMany({
        where: { id: { in: ids } },
        select: { id: true, amount: true },
      })
    ).map((o) => [o.id, o.amount]),
  );
  return rows.map((r, i) => {
    if (r.amount) return r;
    const id = plan[i]?.row.match?.id;
    return { ...r, amount: String(id ? (amounts.get(id) ?? 0) : 0) };
  });
}

/** Read-only preview: per entity, how many rows would be created, merged, left unchanged, or rejected. */
export async function previewContract(c: Contract) {
  const resolve = makeResolver(c, await knownAccountRefs(c.source.system));
  const out: EntityPreview[] = [];
  let pending = new Set<string>();
  for (const step of STEPS) {
    let rows = step.rows(c, resolve);
    if (step.kind === "opportunities") rows = await fillAmounts(rows);
    const plan = rows.length ? await planImport(step.kind, rows) : [];
    if (step.kind === "accounts") pending = pendingAccounts(c, plan);
    const p: EntityPreview = {
      key: step.key,
      total: rows.length,
      create: 0,
      merge: 0,
      unchanged: 0,
      errors: [],
      changes: [],
    };
    for (const [i, item] of plan.entries()) {
      const r = item.row;
      const accountOnly =
        r.errors.length === 1 &&
        r.errors[0].field === "account" &&
        pending.has(lc(rows[i].account ?? ""));
      if (r.status === "error" && !accountOnly)
        p.errors.push({ label: r.label, message: r.errors.map((e) => e.message).join("; ") });
      else if (r.status === "new" || accountOnly) {
        p.create++;
        if (p.changes.length < 50) p.changes.push({ label: r.label, action: "create", diff: [] });
      } else if (r.defaultDecision === "merge") {
        p.merge++;
        if (p.changes.length < 50)
          p.changes.push({ label: r.label, action: "merge", diff: r.diff });
      } else p.unchanged++;
    }
    out.push(p);
  }
  const idx = await buildAccountIndex();
  const children = await planChildren(c, resolve, idx, pending);
  for (const kind of ["touch", "task"] as const) {
    const list = children.filter((x) => x.kind === kind);
    out.push({
      key: kind === "touch" ? "activities" : "tasks",
      total: list.length,
      create: list.filter((x) => x.status === "new").length,
      merge: list.filter((x) => x.status === "merge").length,
      unchanged: list.filter((x) => x.status === "same").length,
      errors: list
        .filter((x) => x.status === "error")
        .map((x) => ({ label: x.label, message: x.error ?? "" })),
      changes: list
        .filter((x) => x.status === "new" || x.status === "merge")
        .slice(0, 50)
        .map((x) => ({
          label: x.label,
          action: x.status === "new" ? ("create" as const) : ("merge" as const),
          diff: [],
        })),
    });
  }
  return { source: c.source, visibility: c.visibility, version: c.version, entities: out };
}

/**
 * Commits a contract file: one ImportBatch per entity kind, all sharing a groupId (undo reverts the group).
 * Re-plans on the server; default decisions (merge changed duplicates, skip identical ones, create new).
 */
export async function commitContract(c: Contract, fileName?: string | null) {
  const groupId = randomUUID();
  const system = c.source.system;
  const resolve = makeResolver(c, await knownAccountRefs(system));
  const counts: Record<
    string,
    { created: number; merged: number; skipped: number; errors: number }
  > = {};
  const touched = new Set<string>();

  for (const step of STEPS) {
    let rows = step.rows(c, resolve);
    if (!rows.length) continue;
    if (step.kind === "opportunities") rows = await fillAmounts(rows);
    const res = await commitImport({
      kind: step.kind,
      rows,
      decisions: {},
      fileName,
      inputType: "contract",
      source: system,
      groupId,
      quiet: true,
    });
    counts[step.key] = res.counts;
    const list = c.entities[step.key] as Array<{
      externalId?: string;
      nextStepDate?: string;
      sourceUrl?: string;
    }>;
    for (const [i, entityId] of Object.entries(res.rowEntities)) {
      await upsertRef(
        system,
        step.entity,
        list[Number(i)]?.externalId,
        entityId,
        list[Number(i)]?.sourceUrl,
      );
      if (step.kind === "accounts") touched.add(entityId);
      const nsd = list[Number(i)]?.nextStepDate;
      if (step.kind === "opportunities" && nsd)
        await updateOpportunity(entityId, {
          nextStepDate: new Date(`${nsd.slice(0, 10)}T12:00:00.000Z`),
        });
    }
  }

  const idx = await buildAccountIndex();
  const plans = await planChildren(c, resolve, idx, new Set());
  const records = await applyChildren(plans, idx, c, resolve);
  if (records.length) {
    await db.importBatch.create({
      data: {
        kind: "contract",
        fileName: fileName ?? null,
        inputType: "contract",
        source: system,
        groupId,
        counts: {
          created: records.filter((r) => r.action === "created").length,
          merged: records.filter((r) => r.action === "merged").length,
          skipped: plans.filter((p) => p.status === "same").length,
          errors: plans.filter((p) => p.status === "error").length,
        },
        records: {
          create: records.map(({ externalId: _e, sourceUrl: _u, ...r }) => ({
            ...r,
            before: (r.before ?? undefined) as Prisma.InputJsonValue,
          })),
        },
      },
    });
    for (const r of records)
      await upsertRef(system, r.entityType as RefEntity, r.externalId, r.entityId, r.sourceUrl);
  }
  for (const kind of ["touch", "task"] as const) {
    const list = plans.filter((p) => p.kind === kind);
    if (list.length)
      counts[kind === "touch" ? "activities" : "tasks"] = {
        created: records.filter((r) => r.entityType === kind && r.action === "created").length,
        merged: records.filter((r) => r.entityType === kind && r.action === "merged").length,
        skipped: list.filter((p) => p.status === "same").length,
        errors: list.filter((p) => p.status === "error").length,
      };
  }
  if (touched.size)
    await computeScoresForAccounts(db, { now: new Date(), accountIds: [...touched] });

  const total = Object.values(counts).reduce(
    (s, x) => ({ created: s.created + x.created, merged: s.merged + x.merged }),
    { created: 0, merged: 0 },
  );
  const summary = `Data contract from ${system}${fileName ? ` (${fileName})` : ""}: ${total.created} created, ${total.merged} merged`;
  await logActivity({
    entityType: "import",
    entityId: groupId,
    action: "import.applied",
    summary,
    diff: counts,
  });
  await audit(db, {
    action: "contract.import",
    entityType: "import",
    entityId: groupId,
    summary,
    meta: counts,
  });
  return { groupId, counts };
}
