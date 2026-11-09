import { z } from "zod";
import { handler } from "@/lib/server/http";
import { exportContract } from "@/lib/server/contract/export";

const Query = z.object({
  visibility: z.enum(["internal", "customer-safe"]).default("internal"),
  accounts: z.string().optional(),
});

/** Downloads the workspace (or ?accounts=id,id) as an ACC data contract file. */
export const GET = handler(async (req: Request) => {
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const c = await exportContract({
    visibility: q.visibility,
    accountIds: q.accounts?.split(",").filter(Boolean),
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(c, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="acc-data-${q.visibility}-${stamp}.json"`,
    },
  });
});
