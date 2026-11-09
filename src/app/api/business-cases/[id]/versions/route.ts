import { z } from "zod";
import { saveVersion } from "@/lib/server/business-cases";
import { handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { label } = z.object({ label: z.string().trim().max(80).nullish() }).parse((await readJson(req)) ?? {});
  return json(await saveVersion((await params).id, label), { status: 201 });
});
