import { z } from "zod";
import { db } from "@/lib/db";
import { computeRelevance } from "@/lib/scoring/relevance";
import { getSetting } from "@/lib/settings/server";
import { tagText } from "@/lib/tagging/rules";
import { logActivity } from "@/lib/server/activity";
import { HttpError, handler, json, readJson } from "@/lib/server/http";
import { querySignalsByIds } from "@/lib/server/signals";

type Ctx = { params: Promise<{ id: string }> };

/** Signal detail including the transparent tagging hits and relevance breakdown. */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const [row] = await querySignalsByIds([id]);
  if (!row) throw new HttpError(404, "Signal not found");
  const [rules, cfg] = await Promise.all([
    getSetting("tagging.rules"),
    getSetting("scoring.relevance"),
  ]);
  const tags = tagText(`${row.title} ${row.summary ?? ""}`, rules);
  const rel = computeRelevance(
    {
      publishedAt: new Date(row.publishedAt),
      source: row.source,
      keywordHits: tags.hits.length,
      tier: row.accountTier,
      now: new Date(),
    },
    cfg,
  );
  const [notes, touches, opps] = await Promise.all([
    db.note.findMany({
      where: { entityType: "signal", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.touch.count({ where: { sourceSignalId: id } }),
    db.opportunity.findMany({ where: { sourceSignalId: id }, select: { id: true, name: true } }),
  ]);
  return json({
    ...row,
    tagHits: tags.hits,
    relevanceBreakdown: rel,
    notes,
    convertedTouches: touches,
    convertedOpps: opps,
  });
});

const Patch = z
  .object({
    read: z.boolean(),
    starred: z.boolean(),
    dismissed: z.boolean(),
    inNextSummary: z.boolean(),
  })
  .partial()
  .strict();

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = Patch.parse(await readJson(req));
  const s = await db.signal.update({ where: { id }, data: body });
  if (body.inNextSummary !== undefined || body.dismissed) {
    await logActivity({
      entityType: "account",
      entityId: s.accountId,
      action: body.dismissed ? "signal.dismissed" : "signal.summary",
      summary: `${body.dismissed ? "Dismissed" : body.inNextSummary ? "Added to next summary" : "Removed from summary"}: ${s.title.slice(0, 90)}`,
    });
  }
  return json((await querySignalsByIds([id]))[0]);
});
