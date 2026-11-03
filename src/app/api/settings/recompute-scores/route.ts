import { db } from "@/lib/db";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { handler, json } from "@/lib/server/http";

export const POST = handler(async () => {
  const t0 = Date.now();
  await computeScoresForAccounts(db, { now: new Date() });
  return json({ ok: true, ms: Date.now() - t0 });
});
