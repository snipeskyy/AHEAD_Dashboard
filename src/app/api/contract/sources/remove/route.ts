import { z } from "zod";
import { handler, json, readJson } from "@/lib/server/http";
import { removeSource } from "@/lib/server/contract/staging";

const Body = z.object({ system: z.string().min(1).max(80), confirm: z.string() });

/** Remove everything a source contributed (backup first; typed confirmation). */
export const POST = handler(async (req: Request) => {
  const b = Body.parse(await readJson(req));
  return json(await removeSource(b.system, b.confirm));
});
