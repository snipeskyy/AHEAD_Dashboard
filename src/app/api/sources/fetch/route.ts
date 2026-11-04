import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({
  adapterId: z.string().max(40).optional(),
  accountId: z.string().max(60).optional(),
  /** Bulk: one queued job per account (e.g. right after an import). */
  accountIds: z.array(z.string().max(60)).max(1000).optional(),
});

/** "Fetch now": queues a job for the worker (which owns all outbound requests). */
export const POST = handler(async (req: Request) => {
  const body = Body.parse(await readJson(req).catch(() => ({})));
  if (body.accountIds?.length) {
    const { count } = await db.jobRequest.createMany({
      data: body.accountIds.map((accountId) => ({
        kind: "fetch-now",
        payload: { accountId, ...(body.adapterId ? { adapterId: body.adapterId } : {}) },
      })),
    });
    return json({ queued: true, jobs: count }, { status: 202 });
  }
  const job = await db.jobRequest.create({ data: { kind: "fetch-now", payload: body } });
  return json({ queued: true, jobId: job.id }, { status: 202 });
});
