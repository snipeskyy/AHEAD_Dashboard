import "server-only";
import { db } from "@/lib/db";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { audit } from "@/lib/db-extensions";
import { logActivity } from "../activity";
import { HttpError } from "../http";

const DATE_FIELDS = new Set(["closeDate", "stageChangedAt", "closedAt"]);

/** JSON snapshot → Prisma update data (ISO strings back to Dates). */
const revive = (before: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(before).map(([k, v]) => [
      k,
      DATE_FIELDS.has(k) && typeof v === "string" ? new Date(v) : v,
    ]),
  );

/** What undoing would remove, including records added to those accounts since the import. */
export async function undoImpact(batchId: string) {
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    include: { records: true },
  });
  if (!batch) throw new HttpError(404, "Import not found");
  const createdAccounts = batch.records
    .filter((r) => r.entityType === "account" && r.action === "created")
    .map((r) => r.entityId);
  const ownIds = new Set(batch.records.map((r) => r.entityId));
  const [opps, contacts, signals] = createdAccounts.length
    ? await Promise.all([
        db.opportunity.findMany({
          where: { accountId: { in: createdAccounts } },
          select: { id: true },
        }),
        db.contact.findMany({
          where: { accountId: { in: createdAccounts } },
          select: { id: true },
        }),
        db.signal.count({ where: { accountId: { in: createdAccounts } } }),
      ])
    : [[], [], 0];
  return {
    batch,
    created: batch.records.filter((r) => r.action === "created").length,
    merged: batch.records.filter((r) => r.action === "merged").length,
    dependent: {
      opportunities: opps.filter((o) => !ownIds.has(o.id)).length,
      contacts: contacts.filter((c) => !ownIds.has(c.id)).length,
      signals,
    },
  };
}

/** Rolls back one import: deletes what it created and restores what it merged (newest first). */
export async function undoImport(batchId: string) {
  const { batch } = await undoImpact(batchId);
  if (batch.status === "undone") throw new HttpError(409, "This import was already undone");
  const affected = new Set<string>();

  for (const r of [...batch.records].reverse()) {
    const before = revive((r.before ?? {}) as Record<string, unknown>);
    switch (r.entityType) {
      case "account":
        if (r.action === "created") await db.account.deleteMany({ where: { id: r.entityId } });
        else {
          await db.account.updateMany({ where: { id: r.entityId }, data: before });
          affected.add(r.entityId);
        }
        break;
      case "contact": {
        const c = await db.contact.findUnique({
          where: { id: r.entityId },
          select: { accountId: true },
        });
        if (c) affected.add(c.accountId);
        if (r.action === "created") await db.contact.deleteMany({ where: { id: r.entityId } });
        else await db.contact.updateMany({ where: { id: r.entityId }, data: before });
        break;
      }
      case "opportunity": {
        const o = await db.opportunity.findUnique({
          where: { id: r.entityId },
          select: { accountId: true },
        });
        if (o) affected.add(o.accountId);
        if (r.action === "created") await db.opportunity.deleteMany({ where: { id: r.entityId } });
        else await db.opportunity.updateMany({ where: { id: r.entityId }, data: before });
        break;
      }
      case "note":
        await db.note.deleteMany({ where: { id: r.entityId } });
        break;
      // Shareable packs (Phase 8): items attached to an account; created only, so undo deletes them.
      case "proposal":
        await db.fieldProposal.deleteMany({ where: { id: r.entityId, status: "pending" } });
        break;
      case "initiative":
        await db.initiative.deleteMany({ where: { id: r.entityId } });
        break;
      case "tech":
        await db.techStackHypothesis.deleteMany({ where: { id: r.entityId } });
        break;
      case "comment":
        await db.comment.deleteMany({ where: { id: r.entityId } });
        break;
      case "partner-rep": {
        if (r.action === "created") {
          await db.partnerRep.deleteMany({ where: { id: r.entityId } });
          break;
        }
        const { addedLinks = [], ...fields } = before as { addedLinks?: string[] };
        await db.partnerRep.updateMany({ where: { id: r.entityId }, data: fields });
        await db.partnerRepAccount.deleteMany({
          where: { repId: r.entityId, accountId: { in: addedLinks } },
        });
        break;
      }
    }
  }

  await db.importBatch.update({
    where: { id: batchId },
    data: { status: "undone", undoneAt: new Date() },
  });
  const existing = await db.account.findMany({
    where: { id: { in: [...affected] } },
    select: { id: true },
  });
  if (existing.length)
    await computeScoresForAccounts(db, { now: new Date(), accountIds: existing.map((a) => a.id) });
  await logActivity({
    entityType: "import",
    entityId: batchId,
    action: "import.undone",
    summary: `Undid ${batch.kind} import${batch.fileName ? ` (${batch.fileName})` : ""}`,
  });
  await audit(db, { action: "import.undo", entityType: "import", entityId: batchId, summary: `Undid ${batch.kind} import${batch.fileName ? ` (${batch.fileName})` : ""}` });
  return { ok: true };
}
