import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { SandboxSpecSchema, type SandboxSpec } from "@/modules/sandbox/lib/spec";
import { SANDBOX_TEMPLATES } from "@/modules/sandbox/lib/templates";
import { HttpError } from "./http";

export const CreateScenarioBody = z.object({
  name: z.string().trim().min(2).max(120),
  accountId: z.string().nullish(),
  templateId: z.string().default("empty"),
});
export const PatchScenarioBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(2000).nullish(),
  accountId: z.string().nullable().optional(),
  spec: z.unknown().optional(),
});

const asJson = (s: SandboxSpec) => s as unknown as Prisma.InputJsonValue;

/** Validates a spec and its references (unique ids; racks and units inside the room). */
export function validSpec(raw: unknown): SandboxSpec {
  const s = SandboxSpecSchema.parse(raw);
  const ids = [...s.racks.map((r) => r.id), ...s.coolingUnits.map((u) => u.id)];
  if (new Set(ids).size !== ids.length)
    throw new HttpError(400, "Rack and cooling unit ids must be unique");
  for (const r of s.racks)
    if (r.x + 1 > s.room.widthTiles || r.y + 2 > s.room.depthTiles)
      throw new HttpError(400, `${r.label} is outside the room`);
  return s;
}

/** Older stub specs (v1) are replaced by an empty v2 room rather than failing to open. */
export const readSpec = (raw: unknown): SandboxSpec => {
  const p = SandboxSpecSchema.safeParse(raw);
  return p.success ? p.data : SANDBOX_TEMPLATES[0].spec;
};

export async function listScenarios(accountId?: string | null) {
  const rows = await db.sandboxScenario.findMany({
    where: accountId ? { accountId } : undefined,
    orderBy: { updatedAt: "desc" },
  });
  const accounts = new Map(
    (
      await db.account.findMany({
        where: { id: { in: rows.map((r) => r.accountId).filter((x): x is string => !!x) } },
        select: { id: true, name: true },
      })
    ).map((a) => [a.id, a]),
  );
  return rows.map((r) => ({
    ...r,
    spec: readSpec(r.spec),
    account: r.accountId ? (accounts.get(r.accountId) ?? null) : null,
  }));
}

export async function createScenario(input: z.infer<typeof CreateScenarioBody>) {
  const t = SANDBOX_TEMPLATES.find((x) => x.id === input.templateId);
  if (!t) throw new HttpError(400, "Unknown template");
  const s = await db.sandboxScenario.create({
    data: { name: input.name, accountId: input.accountId ?? null, spec: asJson(t.spec) },
  });
  await audit(db, {
    action: "sandbox.create",
    entityType: "sandboxScenario",
    entityId: s.id,
    summary: `Created sandbox scenario “${s.name}” from “${t.name}”`,
  });
  return s;
}

export async function getScenario(id: string) {
  const s = await db.sandboxScenario.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, "Scenario not found");
  const [account, base] = await Promise.all([
    s.accountId
      ? db.account.findUnique({ where: { id: s.accountId }, select: { id: true, name: true } })
      : null,
    s.baseId
      ? db.sandboxScenario.findUnique({
          where: { id: s.baseId },
          select: { id: true, name: true, spec: true },
        })
      : null,
  ]);
  return {
    ...s,
    spec: readSpec(s.spec),
    account,
    base: base ? { ...base, spec: readSpec(base.spec) } : null,
  };
}

export async function updateScenario(id: string, p: z.infer<typeof PatchScenarioBody>) {
  const { spec, ...rest } = p;
  return db.sandboxScenario.update({
    where: { id },
    data: { ...rest, ...(spec !== undefined ? { spec: asJson(validSpec(spec)) } : {}) },
  });
}

/** Copy as a what-if (keeps a link to the original for before/after compare). */
export async function duplicateScenario(id: string, name?: string) {
  const s = await db.sandboxScenario.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, "Scenario not found");
  const copy = await db.sandboxScenario.create({
    data: {
      name: name?.trim() || `${s.name} (what-if)`,
      accountId: s.accountId,
      baseId: s.id,
      spec: s.spec as Prisma.InputJsonValue,
    },
  });
  await audit(db, {
    action: "sandbox.what-if",
    entityType: "sandboxScenario",
    entityId: copy.id,
    summary: `What-if copy of “${s.name}”`,
  });
  return copy;
}
