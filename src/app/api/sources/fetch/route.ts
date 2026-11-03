import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({
  adapterId: z.string().max(40).optional(),
  accountId: z.string().max(60).optional(),
});

/** "Fetch now": queues a job for the worker (which owns all outbound requests). */
export const POST = handler(async (req: Request) => {
  const body = Body.parse(await readJson(req).catch(() => ({})));
  const job = await db.jobRequest.create({ data: { kind: "fetch-now", payload: body } });
  return json({ queued: true, jobId: job.id }, { status: 202 });
});
