import { z } from "zod";
import { db } from "@/lib/db";
import { intelPolicyViolation } from "@/lib/intel/policy";
import { HttpError, handler, json, readJson } from "@/lib/server/http";

const Body = z.object({
  category: z.string().trim().min(2).max(60),
  technology: z.string().trim().min(2).max(120),
  evidence: z.string().trim().min(2).max(500),
  sourceUrl: z.string().url().nullish(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = Body.parse(await readJson(req));
  const account = await db.account.findUnique({ where: { id }, select: { isDemo: true } });
  if (!account) throw new HttpError(404, "Account not found");
  const violation = intelPolicyViolation(account, {
    source: "user-hypothesis",
    sourceUrl: body.sourceUrl,
  });
  if (violation) throw new HttpError(400, violation);
  return json(
    await db.techStackHypothesis.create({
      data: { ...body, accountId: id, source: "user-hypothesis" },
    }),
    { status: 201 },
  );
});
