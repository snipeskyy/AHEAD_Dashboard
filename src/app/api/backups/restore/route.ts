import { z } from "zod";
import { restoreFromBackup } from "@/lib/server/backups";
import { handler, json, readJson } from "@/lib/server/http";

/** Destructive: requires the typed confirmation word. A pre-restore backup is always written first. */
export const POST = handler(async (req: Request) => {
  const { file } = z.object({ file: z.string().min(1).max(200), confirm: z.literal("RESTORE") }).parse(await readJson(req));
  return json(await restoreFromBackup(file));
});
