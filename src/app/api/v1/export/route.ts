import { z } from "zod";
import { handler, json } from "@/lib/server/http";
import { exportContract } from "@/lib/server/contract/export";
import { requireApiToken } from "@/lib/server/local-api";

const Query = z.object({ visibility: z.enum(["internal", "customer-safe"]).default("internal") });

/** Local read-only API: the whole workspace as one data contract file. */
export const GET = handler(async (req: Request) => {
  await requireApiToken(req);
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json(await exportContract({ visibility: q.visibility, quiet: true }));
});
