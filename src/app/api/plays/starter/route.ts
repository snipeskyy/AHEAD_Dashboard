import { z } from "zod";
import { db } from "@/lib/db";
import { clearStarterPlays, ensureStarterPlays } from "@/lib/demand-gen/install-starter-plays";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({ action: z.enum(["clear", "restore"]) });

/** Clear (unused) Starter Plays, or restore any that are missing. */
export const POST = handler(async (req: Request) => {
  const { action } = Body.parse(await readJson(req));
  if (action === "clear") return json(await clearStarterPlays(db));
  return json({ restored: await ensureStarterPlays(db, { force: true }) });
});
