import { db } from "@/lib/db";
import { getScenario, PatchScenarioBody, updateScenario } from "@/lib/server/sandbox";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => json(await getScenario((await params).id)));

export const PATCH = handler(async (req: Request, { params }: Ctx) => json(await updateScenario((await params).id, PatchScenarioBody.parse(await readJson(req)))));

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await db.sandboxScenario.delete({ where: { id: (await params).id } });
  return json({ ok: true });
});
