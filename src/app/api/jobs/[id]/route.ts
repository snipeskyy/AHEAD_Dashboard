import { db } from "@/lib/db";
import { handler, HttpError, json } from "@/lib/server/http";

/** One job's status and result, polled by "Fetch now" to report what actually happened. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const job = await db.jobRequest.findUnique({ where: { id: (await ctx.params).id } });
  if (!job) throw new HttpError(404, "Job not found");
  return json(job);
});
