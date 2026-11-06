import { z } from "zod";
import { PlayPackSchema, planPlays } from "@/lib/server/packs/plays";
import { handler, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: Request) => {
  const { pack } = z.object({ pack: z.unknown() }).parse(await readJson(req));
  const p = PlayPackSchema.parse(pack);
  return json({ createdBy: p.createdBy, plays: await planPlays(p) });
});
