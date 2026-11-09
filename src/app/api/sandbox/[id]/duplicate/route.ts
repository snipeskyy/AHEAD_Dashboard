import { z } from "zod";
import { duplicateScenario } from "@/lib/server/sandbox";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { name } = z.object({ name: z.string().max(120).nullish() }).parse((await readJson(req)) ?? {});
  return json(await duplicateScenario((await params).id, name ?? undefined), { status: 201 });
});
