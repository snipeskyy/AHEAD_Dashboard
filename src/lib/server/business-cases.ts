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
  const c = await db.businessCase.create({
    data: { name: input.name, accountId, opportunityId: input.opportunityId ?? null, model: json(validModel(tpl.model)) },
  });
  await audit(db, { action: "tco.create", entityType: "businessCase", entityId: c.id, summary: `Created business case “${c.name}” from “${tpl.name}”` });
  return c;
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
