import { z } from "zod";
import { practiceLabel } from "@/config/practice-areas";
import { db } from "@/lib/db";
import { PracticeStatusSchema } from "@/lib/domain/enums";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { logActivity } from "@/lib/server/activity";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({ practiceArea: z.string().min(1), status: PracticeStatusSchema });

export const PUT = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { practiceArea, status } = Body.parse(await readJson(req));
  const row = await db.accountPracticeStatus.upsert({
    where: { accountId_practiceArea: { accountId: id, practiceArea } },
    create: { accountId: id, practiceArea, status },
    update: { status },
  });
  await computeScoresForAccounts(db, { now: new Date(), accountIds: [id] });
  await logActivity({
    entityType: "account",
    entityId: id,
    action: "whitespace.updated",
    summary: `${practiceLabel(practiceArea)} → ${status}`,
  });
  return json(row);
});
