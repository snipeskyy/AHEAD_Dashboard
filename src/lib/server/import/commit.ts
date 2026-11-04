import "server-only";
import type { Prisma } from "@prisma/client";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { db } from "@/lib/db";
import type { AccountImportValue } from "@/lib/import/kinds/accounts";
import type { ContactImportValue } from "@/lib/import/kinds/contacts";
import type { NoteImportValue } from "@/lib/import/kinds/notes";
import type { OppImportValue } from "@/lib/import/kinds/opportunities";
import type { PartnerRepImportValue } from "@/lib/import/kinds/partner-reps";
import type { ImportKind, InputType, MappedRow } from "@/lib/import/types";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { logActivity } from "../activity";
import { createOpportunity, updateOpportunity } from "../opportunities";
import { mergePlan } from "./diff";
import { planImport, type Decision, type PlanItem } from "./plan";

export interface CommitInput {
  kind: ImportKind;
  rows: MappedRow[];
  decisions: Record<number, Decision>;
  fileName?: string | null;
  inputType: InputType;
}

type Rec = { entityType: string; entityId: string; action: "created" | "merged"; before?: unknown };

/**
 * Re-plans on the server (never trusts the client's preview), applies each row's decision,
 * and records every created/merged entity in an ImportBatch so the whole import can be undone.
 */
export async function commitImport(input: CommitInput) {
  const plan = await planImport(input.kind, input.rows);
  const records: Rec[] = [];
  const touched = new Set<string>();
  const counts = { created: 0, merged: 0, skipped: 0, errors: 0 };

  for (const item of plan) {
    const decision =
      item.row.status === "error"
        ? "skip"
        : (input.decisions[item.row.index] ?? item.row.defaultDecision);
    if (item.row.status === "error") counts.errors++;
    if (decision === "skip" || !item.row.options.includes(decision)) {
      if (item.row.status !== "error") counts.skipped++;
      continue;
    }
    if (decision === "merge" && item.row.match?.id) {
      const rec = await mergeOne(input.kind, item);
      if (rec) {
        records.push(rec);
        counts.merged++;
      } else counts.skipped++;
    } else {
      records.push(await createOne(input.kind, item));
      counts.created++;
    }
    if (item.row.accountId) touched.add(item.row.accountId);
    if (input.kind === "accounts") touched.add(records.at(-1)!.entityId);
  }

  const batch = await db.importBatch.create({
    data: {
      kind: input.kind,
      fileName: input.fileName ?? null,
      inputType: input.inputType,
      counts,
      records: {
        create: records.map((r) => ({
          ...r,
          before: (r.before ?? undefined) as Prisma.InputJsonValue,
        })),
      },
    },
  });
  if (touched.size)
    await computeScoresForAccounts(db, { now: new Date(), accountIds: [...touched] });
  if (counts.created || counts.merged)
    await logActivity({
      entityType: "import",
      entityId: batch.id,
      action: "import.applied",
      summary: `Imported ${input.kind}: ${counts.created} created, ${counts.merged} merged${input.fileName ? ` from ${input.fileName}` : ""}`,
      diff: counts,
    });
  const createdAccounts =
    input.kind === "accounts"
      ? records.filter((r) => r.action === "created").map((r) => r.entityId)
      : [];
  return { batchId: batch.id, counts, createdAccounts };
}

async function createOne(kind: ImportKind, item: PlanItem): Promise<Rec> {
  const accountId = item.row.accountId!;
  switch (kind) {
    case "accounts": {
      const v = item.value as AccountImportValue;
      const a = await db.account.create({
        data: {
          name: v.name,
          domain: v.domain,
          ticker: v.ticker,
          industry: v.industry ?? "Unclassified",
          subIndustry: v.subIndustry,
          hq: v.hq,
          tier: v.tier ?? "Growth",
          employeeBand: v.employeeBand,
          revenueBand: v.revenueBand,
          ownerNotes: v.ownerNotes,
          isDemo: false,
          // Google News is opt-in per account (no official API); job boards only when given.
          sourceConfig: {
            googleNews: false,
            rssFeeds: [],
            greenhouseSlug: v.greenhouseSlug,
            leverSlug: v.leverSlug,
          },
          practiceStatus: {
            create: DEFAULT_PRACTICE_AREAS.map((p) => ({
              practiceArea: p.id,
              status: "NotEngaged",
            })),
          },
        },
      });
      return { entityType: "account", entityId: a.id, action: "created" };
    }
    case "contacts": {
      const { account: _a, ...v } = item.value as ContactImportValue;
      const c = await db.contact.create({ data: { ...v, accountId } });
      return { entityType: "contact", entityId: c.id, action: "created" };
    }
    case "opportunities": {
      const { account: _a, ...v } = item.value as OppImportValue;
      const o = await createOpportunity({ ...v, accountId }, { quiet: true });
      return { entityType: "opportunity", entityId: o.id, action: "created" };
    }
    case "notes": {
      const v = item.value as NoteImportValue;
      const n = await db.note.create({
        data: {
          entityType: "account",
          entityId: accountId,
          body: v.body,
          internalOnly: true,
          ...(v.date ? { createdAt: v.date } : {}),
        },
      });
      return { entityType: "note", entityId: n.id, action: "created" };
    }
    case "partner-reps": {
      const { accounts: _a, ...v } = item.value as PartnerRepImportValue;
      const r = await db.partnerRep.create({
        data: {
          ...v,
          accounts: { create: (item.accountIds ?? []).map((id) => ({ accountId: id })) },
        },
      });
      return { entityType: "partner-rep", entityId: r.id, action: "created" };
    }
  }
}

async function mergeOne(kind: ImportKind, item: PlanItem): Promise<Rec | null> {
  const id = item.row.match!.id;
  const value = item.value as Record<string, unknown>;
  const { patch, before, addLinks } = await mergePlan(kind, id, value, item.accountIds);
  if (!Object.keys(patch).length && !addLinks.length) return null;
  switch (kind) {
    case "accounts": {
      const v = item.value as AccountImportValue;
      const acc = await db.account.findUnique({ where: { id }, select: { sourceConfig: true } });
      const cfg = (acc?.sourceConfig ?? {}) as Record<string, unknown>;
      const slugs = {
        ...(v.greenhouseSlug ? { greenhouseSlug: v.greenhouseSlug } : {}),
        ...(v.leverSlug ? { leverSlug: v.leverSlug } : {}),
      };
      if (Object.keys(slugs).length) before.sourceConfig = cfg;
      await db.account.update({
        where: { id },
        data: {
          ...patch,
          ...(Object.keys(slugs).length ? { sourceConfig: { ...cfg, ...slugs } } : {}),
        },
      });
      return { entityType: "account", entityId: id, action: "merged", before };
    }
    case "contacts":
      await db.contact.update({ where: { id }, data: patch });
      return { entityType: "contact", entityId: id, action: "merged", before };
    case "opportunities": {
      const prev = await db.opportunity.findUnique({ where: { id } });
      await updateOpportunity(id, patch as Parameters<typeof updateOpportunity>[1]);
      // Snapshot every field updateOpportunity's rules may touch, so undo restores them exactly.
      const snap = prev && {
        ...before,
        stage: prev.stage,
        probability: prev.probability,
        forecastCategory: prev.forecastCategory,
        closeDate: prev.closeDate,
        closeDatePushes: prev.closeDatePushes,
        stageChangedAt: prev.stageChangedAt,
        closedAt: prev.closedAt,
      };
      return { entityType: "opportunity", entityId: id, action: "merged", before: snap };
    }
    case "partner-reps":
      await db.partnerRep.update({
        where: { id },
        data: { ...patch, accounts: { create: addLinks.map((accountId) => ({ accountId })) } },
      });
      return {
        entityType: "partner-rep",
        entityId: id,
        action: "merged",
        before: { ...before, addedLinks: addLinks },
      };
    case "notes":
      return null;
  }
}
