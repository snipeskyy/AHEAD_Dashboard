import { z } from "zod";
import { importPlays, PlayPackSchema } from "@/lib/server/packs/plays";
import { handler, json, readJson } from "@/lib/server/http";

export const POST = handler(async (req: Request) => {
  const body = z.object({ pack: z.unknown(), overwrite: z.boolean().default(false) }).parse(await readJson(req));
  return json(await importPlays(PlayPackSchema.parse(body.pack), { overwrite: body.overwrite }), { status: 201 });
});
