import { z } from "zod";
import { db } from "@/lib/db";
import { TierSchema } from "@/lib/domain/enums";
import { normalizeDomain, normalizeTicker } from "@/lib/import/normalize";
import { getAccount360 } from "@/lib/server/accounts";
import { logActivity } from "@/lib/server/activity";
import { HttpError, handler, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) =>
  json(await getAccount360((await ctx.params).id)),
);

const Patch = z
  .object({
    name: z.string().trim().min(2).max(160),
    tier: TierSchema,
    industry: z.string().trim().max(80),
    subIndustry: z.string().trim().max(80).nullable(),
    hq: z.string().trim().max(120).nullable(),
    employeeBand: z.string().max(40).nullable(),
    revenueBand: z.string().max(40).nullable(),
    ownerNotes: z.string().max(5000).nullable(),
    domain: z.string().max(200).nullable(),
    ticker: z.string().max(10).nullable(),
    sourceConfig: z.object({
      googleNews: z.boolean().optional(),
      rssFeeds: z.array(z.string().url()).max(20).optional(),
      greenhouseSlug: z.string().max(80).nullable().optional(),
      leverSlug: z.string().max(80).nullable().optional(),
    }),
  })
  .partial()
  .strict();

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = Patch.parse(await readJson(req));
  const data: Record<string, unknown> = { ...p };
  if (p.domain !== undefined) {
    data.domain = p.domain ? normalizeDomain(p.domain) : null;
    if (p.domain && !data.domain) throw new HttpError(400, "Invalid domain");
  }
  if (p.ticker !== undefined) {
    data.ticker = p.ticker ? normalizeTicker(p.ticker) : null;
    if (p.ticker && !data.ticker) throw new HttpError(400, "Invalid ticker");
  }
  const a = await db.account.update({ where: { id }, data });
  await logActivity({
    entityType: "account",
    entityId: id,
    action: "account.updated",
    summary: `${a.name}: updated ${Object.keys(p).join(", ")}`,
  });
  return json(a);
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const a = await db.account.delete({ where: { id } });
  await logActivity({
    entityType: "account",
    entityId: id,
    action: "account.deleted",
    summary: `Deleted account ${a.name}`,
  });
  return json({ ok: true });
});
