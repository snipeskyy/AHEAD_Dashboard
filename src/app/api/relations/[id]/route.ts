import { z } from "zod";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { handler, HttpError, json, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("link"), accountId: z.string() }),
  z.object({ action: z.literal("unlink") }),
  z.object({ action: z.literal("create-account") }),
]);

/** Roll a parent/subsidiary into ACC: link it to an existing account, or add it as a new account (public ids only). */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const id = (await ctx.params).id;
  const rel = await db.corporateRelation.findUnique({
    where: { id },
    include: { account: { select: { name: true, tier: true } } },
  });
  if (!rel) throw new HttpError(404, "Relation not found");
  const b = Body.parse(await readJson(req));
  if (b.action === "unlink")
    return json(
      await db.corporateRelation.update({ where: { id }, data: { linkedAccountId: null } }),
    );
  let accountId = b.action === "link" ? b.accountId : null;
  if (b.action === "create-account") {
    const a = await db.account.create({
      data: {
        name: rel.name,
        lei: rel.lei,
        wikidataId: rel.wikidataId,
        industry: "Unclassified",
        tier: rel.account.tier,
        isDemo: false,
        sourceConfig: { googleNews: false, rssFeeds: [] },
        practiceStatus: {
          create: DEFAULT_PRACTICE_AREAS.map((p) => ({ practiceArea: p.id, status: "NotEngaged" })),
        },
      },
    });
    accountId = a.id;
    await logActivity({
      entityType: "account",
      entityId: a.id,
      action: "account.created",
      summary: `Added ${rel.name} (${rel.relation} of ${rel.account.name})`,
    });
  }
  return json(
    await db.corporateRelation.update({ where: { id }, data: { linkedAccountId: accountId } }),
  );
});
