import { z } from "zod";
import { parsePack, planPack } from "@/lib/server/packs/import";
import { handler, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: Request) => {
  const { pack } = z.object({ pack: z.unknown() }).parse(await readJson(req));
  const p = parsePack(pack);
  return json({ title: p.title, createdBy: p.createdBy, createdAt: p.createdAt, sections: p.sections, accounts: await planPack(p) });
});
