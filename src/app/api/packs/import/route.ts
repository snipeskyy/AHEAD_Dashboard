import { z } from "zod";
import { commitPack, parsePack } from "@/lib/server/packs/import";
import { handler, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: Request) => {
  const body = z.object({ pack: z.unknown(), decisions: z.record(z.string(), z.enum(["merge", "create", "skip"])).default({}), fileName: z.string().max(200).optional() }).parse(await readJson(req));
  return json(await commitPack(parsePack(body.pack), body.decisions, body.fileName), { status: 201 });
});
