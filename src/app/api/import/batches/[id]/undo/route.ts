import { handler, json } from "@/lib/server/http";
import { undoImport } from "@/lib/server/import/undo";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
  json(await undoImport((await ctx.params).id)),
);
