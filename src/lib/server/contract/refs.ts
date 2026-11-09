import "server-only";
import { db } from "@/lib/db";
import { ContractSchema, type Contract } from "@/lib/contract/schema";
import { internalFieldsPresent } from "@/lib/contract/convert";
import { HttpError } from "../http";

export type RefEntity =
  "account" | "contact" | "opportunity" | "note" | "partner-rep" | "touch" | "task";

/** Validates an uploaded contract file. A file labeled customer-safe that carries internal fields is refused. */
export function parseContract(raw: unknown): Contract {
  const p = ContractSchema.safeParse(raw);
  if (!p.success) {
    const first = p.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new HttpError(400, `Not a valid ACC data contract file. ${first}`);
  }
  if (p.data.visibility === "customer-safe") {
    const bad = internalFieldsPresent(p.data);
    if (bad.length)
      throw new HttpError(
        400,
        `File is labeled customer-safe but contains internal fields: ${bad.join(", ")}`,
      );
  }
  return p.data;
}

/** External account ids already mapped for this sending system → the account's domain (or name) in ACC. */
export async function knownAccountRefs(system: string) {
  // ACC's own files use ACC ids as external ids.
  if (system === "acc") {
    const all = await db.account.findMany({
      where: { isDemo: false },
      select: { id: true, name: true, domain: true },
    });
    return new Map(all.map((a) => [a.id, a.domain || a.name]));
  }
  const refs = await db.externalRef.findMany({ where: { system, entityType: "account" } });
  const accounts = await db.account.findMany({
    where: { id: { in: refs.map((r) => r.entityId) } },
    select: { id: true, name: true, domain: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a.domain || a.name]));
  return new Map(
    refs.flatMap((r) =>
      byId.has(r.entityId) ? [[r.externalId, byId.get(r.entityId)!] as const] : [],
    ),
  );
}

/** entityId by externalId for one entity type (activities and tasks dedupe on it). */
export async function refMap(system: string, entityType: RefEntity) {
  const refs = await db.externalRef.findMany({ where: { system, entityType } });
  const m = new Map(refs.map((r) => [r.externalId, r.entityId]));
  // ACC's own files: the external id is the ACC id (a missing row simply doesn't match).
  return system === "acc" ? { get: (id: string) => m.get(id) ?? id } : m;
}

/**
 * Records the sender's id (and, Phase 15, the link where it found the record). A record with a source link but no
 * id still gets a row (`auto:<entityId>`) so its provenance is kept.
 */
export async function upsertRef(
  system: string,
  entityType: RefEntity,
  externalId: string | undefined,
  entityId: string,
  sourceUrl?: string,
) {
  if (system === "acc" && externalId === entityId) return;
  const id = externalId ?? (sourceUrl ? `auto:${entityId}` : undefined);
  if (!id) return;
  await db.externalRef.upsert({
    where: { system_entityType_externalId: { system, entityType, externalId: id } },
    create: { system, entityType, externalId: id, entityId, sourceUrl: sourceUrl ?? null },
    update: { entityId, ...(sourceUrl ? { sourceUrl } : {}) },
  });
}

/** Where each entity came from (latest import per system), for the "Imported from …" line. */
export async function provenanceFor(entityType: RefEntity, entityId: string) {
  const refs = await db.externalRef.findMany({
    where: { entityType, entityId },
    orderBy: { updatedAt: "desc" },
  });
  return refs.map((r) => ({
    system: r.system,
    sourceUrl: r.sourceUrl,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Ids of these entities in other systems, keyed by system (ACC exports hand them back to the sender). */
export async function externalIdsFor(entityType: RefEntity, ids: string[]) {
  const refs = await db.externalRef.findMany({ where: { entityType, entityId: { in: ids } } });
  const m = new Map<string, Record<string, string>>();
  for (const r of refs)
    if (!r.externalId.startsWith("auto:"))
      m.set(r.entityId, { ...m.get(r.entityId), [r.system]: r.externalId });
  return m;
}
