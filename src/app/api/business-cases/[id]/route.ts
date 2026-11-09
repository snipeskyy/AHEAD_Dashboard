import { db } from "@/lib/db";
import { getCase, PatchCaseBody, updateCase } from "@/lib/server/business-cases";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => json(await getCase((await params).id)));

export const PATCH = handler(async (req: Request, { params }: Ctx) =>
  json(await updateCase((await params).id, PatchCaseBody.parse(await readJson(req)))),
);

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await db.businessCase.delete({ where: { id: (await params).id } });
  return json({ ok: true });
});
