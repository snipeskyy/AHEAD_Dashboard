import "server-only";
import type { Prisma } from "@prisma/client";
import { writeBackupFile } from "@/lib/backup/snapshot";
import { ENTITY_KEYS, type Contract } from "@/lib/contract/schema";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { HttpError } from "../http";
import { undoImport } from "../import/undo";
import { commitContract, previewContract } from "./import";
import { parseContract } from "./refs";

/**
 * Review queue for data-contract files (Phase 15). Files from paste, upload or the staging API (e.g. a Glean
 * action) wait here; nothing reaches the workspace until a person applies them. Applied and discarded payloads
 * are cleared, so the queue never keeps a second copy of the data.
 */
export type StageOrigin = "paste" | "file" | "api";

const summarize = (c: Contract) =>
  Object.fromEntries(ENTITY_KEYS.map((k) => [k, c.entities[k].length]));

export async function stageContract(raw: unknown, origin: StageOrigin, fileName?: string | null) {
  const c = parseContract(raw);
  const s = await db.stagedImport.create({
    data: {
      origin,
      source: c.source.system,
      fileName: fileName ?? null,
      payload: c as unknown as Prisma.InputJsonValue,
      summary: summarize(c),
    },
  });
  await audit(db, {
    action: "contract.stage",
    entityType: "import",
    entityId: s.id,
    summary: `Data from ${c.source.system} is waiting for review (${origin})`,
    meta: s.summary as Record<string, number>,
  });
  return { id: s.id, source: s.source, summary: s.summary };
}

export async function listStaged() {
  const rows = await db.stagedImport.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      origin: true,
      source: true,
      fileName: true,
      summary: true,
      createdAt: true,
    },
    take: 100,
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

async function pending(id: string) {
  const s = await db.stagedImport.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, "Staged import not found");
  if (s.status !== "pending") throw new HttpError(409, `This import was already ${s.status}`);
  return s;
}

export async function reviewStaged(id: string) {
  const s = await pending(id);
  return {
    id: s.id,
    origin: s.origin,
    fileName: s.fileName,
    createdAt: s.createdAt.toISOString(),
    preview: await previewContract(parseContract(s.payload)),
  };
}

export async function applyStaged(id: string) {
  const s = await pending(id);
  const r = await commitContract(
    parseContract(s.payload),
    s.fileName ?? `${s.source} (${s.origin})`,
  );
  await db.stagedImport.update({
    where: { id },
    data: { status: "applied", groupId: r.groupId, decidedAt: new Date(), payload: {} },
  });
  return r;
}

export async function discardStaged(id: string) {
  const s = await pending(id);
  await db.stagedImport.update({
    where: { id },
    data: { status: "discarded", decidedAt: new Date(), payload: {} },
  });
  await audit(db, {
    action: "contract.discard",
    entityType: "import",
    entityId: id,
    summary: `Discarded data from ${s.source} without applying it`,
  });
  return { ok: true };
}

/** What each sending system has contributed (applied imports and linked records). */
export async function sourcesOverview() {
  const [batches, refs, staged] = await Promise.all([
    db.importBatch.groupBy({
      by: ["source"],
      where: { status: "applied", source: { not: null } },
      _count: { _all: true },
    }),
    db.externalRef.groupBy({ by: ["system"], _count: { _all: true } }),
    db.stagedImport.groupBy({
      by: ["source"],
      where: { status: "pending" },
      _count: { _all: true },
    }),
  ]);
  const names = new Set([
    ...batches.map((b) => b.source!),
    ...refs.map((r) => r.system),
    ...staged.map((s) => s.source),
  ]);
  names.delete("acc");
  return [...names].sort().map((system) => ({
    system,
    imports: batches.find((b) => b.source === system)?._count._all ?? 0,
    linkedRecords: refs.find((r) => r.system === system)?._count._all ?? 0,
    pending: staged.find((s) => s.source === system)?._count._all ?? 0,
  }));
}

/**
 * Removes everything a source contributed: undoes each of its applied imports (newest first; records it created are
 * deleted, records it merged into are restored), drops its pending files and its id mappings. Backs up first.
 */
export async function removeSource(system: string, confirm: string) {
  if (confirm !== `REMOVE ${system}`) throw new HttpError(400, `Type REMOVE ${system} to confirm`);
  const backup = await writeBackupFile(db, "pre-remove");
  const batches = await db.importBatch.findMany({
    where: { source: system, status: "applied" },
    orderBy: { createdAt: "desc" },
    select: { id: true, groupId: true },
  });
  const seen = new Set<string>();
  let undone = 0;
  for (const b of batches) {
    const key = b.groupId ?? b.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const still = await db.importBatch.findUnique({
      where: { id: b.id },
      select: { status: true },
    });
    if (still?.status !== "applied") continue;
    await undoImport(b.id);
    undone++;
  }
  const [refs, staged] = await Promise.all([
    db.externalRef.deleteMany({ where: { system } }),
    db.stagedImport.updateMany({
      where: { source: system, status: "pending" },
      data: { status: "discarded", decidedAt: new Date(), payload: {} },
    }),
  ]);
  await audit(db, {
    action: "contract.remove-source",
    entityType: "import",
    entityId: system,
    summary: `Removed all data imported from ${system} (${undone} import${undone === 1 ? "" : "s"} undone)`,
    meta: { undone, refs: refs.count, discarded: staged.count },
  });
  return { undone, refs: refs.count, discarded: staged.count, backup: backup.split("/").pop() };
}
