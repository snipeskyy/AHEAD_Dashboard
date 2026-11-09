import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { TcoModelSchema, type TcoModel } from "@/lib/tco/model";
import { TCO_TEMPLATES } from "@/lib/tco/templates";
import { HttpError } from "./http";

export const CreateCaseBody = z.object({
  name: z.string().trim().min(2).max(120),
  accountId: z.string().nullish(),
  opportunityId: z.string().nullish(),
  templateId: z.string().default("refresh-vs-cloud"),
  /** Seed the on-prem power line from a DC Sandbox scenario (IT kW + estimated PUE). */
  sandboxId: z.string().nullish(),
});

export const PatchCaseBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(["draft", "final"]).optional(),
  accountId: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(),
  model: z.unknown().optional(),
});

/** Validates a model and its references (baseline must be one of the scenarios; line ids unique per scenario). */
export function validModel(raw: unknown): TcoModel {
  const m = TcoModelSchema.parse(raw);
  if (!m.scenarios.some((s) => s.id === m.baselineId)) throw new HttpError(400, "The baseline must be one of the scenarios");
  for (const s of m.scenarios)
    if (new Set(s.lines.map((l) => l.id)).size !== s.lines.length) throw new HttpError(400, `Duplicate line ids in “${s.name}”`);
  return m;
}

const json = (m: TcoModel) => m as unknown as Prisma.InputJsonValue;

export async function listCases(f: { accountId?: string | null; opportunityId?: string | null }) {
  const cases = await db.businessCase.findMany({
    where: { ...(f.accountId ? { accountId: f.accountId } : {}), ...(f.opportunityId ? { opportunityId: f.opportunityId } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { account: { select: { id: true, name: true } }, _count: { select: { versions: true } } },
  });
  return cases;
}

export async function createCase(input: z.infer<typeof CreateCaseBody>) {
  const tpl = TCO_TEMPLATES.find((t) => t.id === input.templateId);
  if (!tpl) throw new HttpError(400, "Unknown template");
  let accountId = input.accountId ?? null;
  if (input.opportunityId) {
    const o = await db.opportunity.findUnique({ where: { id: input.opportunityId }, select: { accountId: true } });
    if (!o) throw new HttpError(404, "Opportunity not found");
    accountId ??= o.accountId;
  }
  let model = validModel(tpl.model);
  if (input.sandboxId) model = await seedFromSandbox(model, input.sandboxId);
  const c = await db.businessCase.create({
    data: { name: input.name, accountId, opportunityId: input.opportunityId ?? null, model: json(model) },
  });
  await audit(db, { action: "tco.create", entityType: "businessCase", entityId: c.id, summary: `Created business case “${c.name}” from “${tpl.name}”` });
  return c;
}

/**
 * Physical drivers only: the scenario's IT load (kW) and estimated PUE go into every power line of the
 * on-prem scenarios. No prices are added; $/kWh and all amounts stay for the user to enter.
 */
async function seedFromSandbox(m: TcoModel, sandboxId: string): Promise<TcoModel> {
  const { roomCalc } = await import("@/modules/sandbox/lib/calc");
  const { createLibrary } = await import("@/modules/sandbox/lib/library");
  const { readSpec } = await import("./sandbox");
  const sc = await db.sandboxScenario.findUnique({ where: { id: sandboxId } });
  if (!sc) throw new HttpError(404, "Sandbox scenario not found");
  const r = roomCalc(readSpec(sc.spec), createLibrary());
  const kw = Math.round(r.drawKw * 10) / 10;
  const pue = r.pue ? Math.round(r.pue * 100) / 100 : undefined;
  return {
    ...m,
    notes: `IT load ${kw} kW and PUE ${pue ?? "—"} come from DC Sandbox scenario “${sc.name}” (illustrative planning model).`,
    scenarios: m.scenarios.map((s) =>
      s.kind === "on-prem" || s.kind === "colocation"
        ? { ...s, lines: s.lines.map((l) => (l.basis === "power" ? { ...l, itKw: kw, utilizationPct: 100, pue: pue ?? l.pue, note: `From sandbox “${sc.name}” (utilization already included in the IT load).` } : l)) }
        : s,
    ),
  };
}

export async function getCase(id: string) {
  const c = await db.businessCase.findUnique({
    where: { id },
    include: { account: { select: { id: true, name: true } }, versions: { orderBy: { version: "desc" }, select: { id: true, version: true, label: true, createdAt: true } } },
  });
  if (!c) throw new HttpError(404, "Business case not found");
  const opp = c.opportunityId ? await db.opportunity.findUnique({ where: { id: c.opportunityId }, select: { id: true, name: true } }) : null;
  return { ...c, opportunity: opp };
}

export async function updateCase(id: string, patch: z.infer<typeof PatchCaseBody>) {
  const { model, ...rest } = patch;
  return db.businessCase.update({ where: { id }, data: { ...rest, ...(model !== undefined ? { model: json(validModel(model)) } : {}) } });
}

/** Freeze the current model as the next version (for side-by-side comparison and exports). */
export async function saveVersion(id: string, label?: string | null) {
  const c = await db.businessCase.findUnique({ where: { id } });
  if (!c) throw new HttpError(404, "Business case not found");
  const last = await db.businessCaseVersion.findFirst({ where: { caseId: id }, orderBy: { version: "desc" }, select: { version: true } });
  const version = (last?.version ?? 0) + 1;
  const v = await db.businessCaseVersion.create({ data: { caseId: id, version, label: label ?? null, model: c.model as Prisma.InputJsonValue } });
  await db.businessCase.update({ where: { id }, data: { version: version + 1 } });
  await audit(db, { action: "tco.version", entityType: "businessCase", entityId: id, summary: `Saved v${version} of “${c.name}”${label ? `: ${label}` : ""}` });
  return v;
}

export async function getVersion(caseId: string, version: number) {
  const v = await db.businessCaseVersion.findUnique({ where: { caseId_version: { caseId, version } } });
  if (!v) throw new HttpError(404, "Version not found");
  return v;
}
