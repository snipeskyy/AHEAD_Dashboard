import type { PrismaClient } from "@prisma/client";
import { currentActor, LOCAL_USER_ID } from "./auth/actor";

/** Models that carry ownerId / teamId / createdBy / updatedBy (Phase 8). Prisma model names in camelCase. */
export const OWNED_MODELS = new Set([
  "Account", "Contact", "Initiative", "TechStackHypothesis", "Signal", "Opportunity", "Play", "Campaign", "Touch",
  "Event", "AccountPlanItem", "Note", "SavedView", "DashboardLayout", "ExportJob", "ImportBatch", "PartnerRep",
  "Task", "Meeting", "SmartList", "PartnerRegistration", "Comment", "BusinessCase", "SandboxScenario", "MutualActionPlan",
]);
/** Deletes of these are written to the audit log. */
export const AUDITED_DELETES = new Set([...OWNED_MODELS].filter((m) => !["Signal", "SavedView", "DashboardLayout"].includes(m)));

type Data = Record<string, unknown>;
const stampCreate = (d: Data) => {
  const a = currentActor();
  // Records the worker creates belong to the local user; createdBy still says "system".
  return { ownerId: a.id === "system" ? LOCAL_USER_ID : a.id, teamId: a.teamId, createdBy: a.id, updatedBy: a.id, ...d };
};
const stampUpdate = (d: Data) => ({ ...d, updatedBy: currentActor().id });
const label = (row: Record<string, unknown> | null) =>
  row ? String(row.name ?? row.title ?? row.displayName ?? row.label ?? row.id) : null;
const lower = (m: string) => m[0].toLowerCase() + m.slice(1);

/**
 * Stamps ownership metadata on every create/update of an owned model and audits deletes.
 * Query extensions don't change result types, so callers keep using the plain `PrismaClient` type.
 */
export function withTeamFoundations(base: PrismaClient): PrismaClient {
  return base.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (OWNED_MODELS.has(model)) args.data = stampCreate(args.data as Data) as typeof args.data;
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (OWNED_MODELS.has(model))
            args.data = (Array.isArray(args.data) ? args.data.map((d) => stampCreate(d as Data)) : stampCreate(args.data as Data)) as typeof args.data;
          return query(args);
        },
        async update({ model, args, query }) {
          if (OWNED_MODELS.has(model)) args.data = stampUpdate(args.data as Data) as typeof args.data;
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (OWNED_MODELS.has(model)) args.data = stampUpdate(args.data as Data) as typeof args.data;
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (OWNED_MODELS.has(model)) {
            args.create = stampCreate(args.create as Data) as typeof args.create;
            args.update = stampUpdate(args.update as Data) as typeof args.update;
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (!AUDITED_DELETES.has(model)) return query(args);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic model delegate lookup by name
          const delegate = (base as any)[lower(model)];
          const before = (await delegate.findUnique({ where: args.where }).catch(() => null)) as Record<string, unknown> | null;
          const res = await query(args);
          await audit(base, { action: "delete", entityType: lower(model), entityId: String(before?.id ?? ""), summary: `Deleted ${lower(model)} “${label(before)}”` });
          return res;
        },
        async deleteMany({ model, args, query }) {
          if (!AUDITED_DELETES.has(model)) return query(args);
          const id = (args.where as Data | undefined)?.id;
          // Deleting one row by id (the common API pattern): capture its label first.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic model delegate lookup by name
          const one = typeof id === "string" ? ((await (base as any)[lower(model)].findUnique({ where: { id } }).catch(() => null)) as Record<string, unknown> | null) : null;
          const res = (await query(args)) as { count: number };
          if (res.count > 0)
            await audit(base, {
              action: "delete",
              entityType: lower(model),
              entityId: typeof id === "string" ? id : null,
              summary: one && res.count === 1 ? `Deleted ${lower(model)} “${label(one)}”` : `Deleted ${res.count} ${lower(model)}${res.count === 1 ? "" : " records"}`,
            });
          return res;
        },
      },
    },
  }) as unknown as PrismaClient;
}

export interface AuditInput {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  meta?: unknown;
}

/** Append one audit row attributed to the current actor. Never throws (auditing must not break the action). */
export async function audit(client: PrismaClient, e: AuditInput) {
  try {
    await client.auditLog.create({
      data: { actorId: currentActor().id, action: e.action, entityType: e.entityType ?? null, entityId: e.entityId ?? null, summary: e.summary.slice(0, 500), meta: (e.meta ?? undefined) as object | undefined },
    });
  } catch (err) {
    console.error("[audit] failed to record", e.action, err);
  }
}
