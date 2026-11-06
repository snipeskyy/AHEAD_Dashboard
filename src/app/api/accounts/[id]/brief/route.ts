import { db } from "@/lib/db";
import { buildBrief } from "@/lib/server/brief";
import { handler, json } from "@/lib/server/http";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  json(await buildBrief(db, (await ctx.params).id)),
);
