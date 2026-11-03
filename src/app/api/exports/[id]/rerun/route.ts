import { rerunExport } from "@/lib/server/exports";
import { handler, json } from "@/lib/server/http";

export const runtime = "nodejs";

/** Re-run an export with fresh data and the next version number. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  json(await rerunExport((await ctx.params).id, new URL(req.url).origin), { status: 201 }),
);
