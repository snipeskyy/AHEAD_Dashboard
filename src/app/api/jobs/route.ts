import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

const KINDS = ["recompute-scores", "rescore-signals", "retag-signals", "fetch-now"] as const;

/** Queue a background job for the worker. GET returns recent jobs (for progress indicators). */
export const POST = handler(async (req: Request) => {
  const { kind, payload } = z
    .object({ kind: z.enum(KINDS), payload: z.record(z.string(), z.unknown()).optional() })
    .parse(await readJson(req));
  const job = await db.jobRequest.create({
    data: { kind, payload: (payload ?? undefined) as object | undefined },
  });
  return json({ id: job.id, status: job.status }, { status: 202 });
});

export const GET = handler(async () =>
  json({ items: await db.jobRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }) }),
);
