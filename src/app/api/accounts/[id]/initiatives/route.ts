import { z } from "zod";
import { db } from "@/lib/db";
import { intelPolicyViolation } from "@/lib/intel/policy";
import { logActivity } from "@/lib/server/activity";
import { HttpError, handler, json, readJson } from "@/lib/server/http";

const Body = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000).nullish(),
  practiceAreas: z.array(z.string()).min(1).max(5),
  sourceUrl: z.string().url().nullish(),
  confidence: z.number().min(0).max(1).default(0.5),
});

/** User-entered initiatives are always recorded as source "user-hypothesis" (optionally with a public URL). */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = Body.parse(await readJson(req));
  const account = await db.account.findUnique({
    where: { id },
    select: { isDemo: true, name: true },
  });
  if (!account) throw new HttpError(404, "Account not found");
  const violation = intelPolicyViolation(account, {
    source: "user-hypothesis",
    sourceUrl: body.sourceUrl,
  });
  if (violation) throw new HttpError(400, violation);
  const i = await db.initiative.create({
    data: { ...body, accountId: id, source: "user-hypothesis" },
  });
  await logActivity({
    entityType: "account",
    entityId: id,
    action: "initiative.created",
    summary: `${account.name}: added initiative "${i.title}"`,
  });
  return json(i, { status: 201 });
});
