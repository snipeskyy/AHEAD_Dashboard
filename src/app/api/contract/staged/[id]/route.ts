import { handler, json } from "@/lib/server/http";
import { discardStaged, reviewStaged } from "@/lib/server/contract/staging";

type Ctx = { params: Promise<{ id: string }> };

/** Field-level preview of a waiting file (read-only). */
export const GET = handler(async (_req: Request, ctx: Ctx) =>
  json(await reviewStaged((await ctx.params).id)),
);

/** Discard without applying; the stored payload is cleared. */
export const DELETE = handler(async (_req: Request, ctx: Ctx) =>
  json(await discardStaged((await ctx.params).id)),
);
