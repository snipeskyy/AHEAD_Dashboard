import { z } from "zod";
import { db } from "@/lib/db";
import { enqueueEnrichment } from "@/lib/enrich/runner";
import { getSetting, setSetting } from "@/lib/settings/server";
import { handler, json, readJson } from "@/lib/server/http";

/** Bulk queue status for the progress UI. */
export const GET = handler(async () => {
  const [counts, paused, recent] = await Promise.all([
    db.enrichmentJob.groupBy({ by: ["status"], _count: true }),
    getSetting("enrichment.paused"),
    db.enrichmentJob.findMany({
      where: {
        OR: [
          { status: { in: ["queued", "running", "failed"] } },
          { finishedAt: { gte: new Date(Date.now() - 6 * 3_600_000) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { account: { select: { name: true } } },
    }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count]));
  return json({
    paused,
    counts: {
      queued: c.queued ?? 0,
      running: c.running ?? 0,
      done: c.done ?? 0,
      failed: c.failed ?? 0,
      cancelled: c.cancelled ?? 0,
    },
    jobs: recent.map((j) => ({
      id: j.id,
      accountId: j.accountId,
      name: j.account.name,
      status: j.status,
      error: j.error,
      attempts: j.attempts,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt,
    })),
  });
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("enqueue"),
    accountIds: z.array(z.string()).max(5000).optional(),
    all: z.boolean().optional(),
    force: z.boolean().optional(),
  }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("retry-failed") }),
  z.object({ action: z.literal("clear-finished") }),
]);

export const POST = handler(async (req: Request) => {
  const b = Body.parse(await readJson(req));
  switch (b.action) {
    case "enqueue": {
      const ids = b.all
        ? (await db.account.findMany({ where: { isDemo: false }, select: { id: true } })).map(
            (a) => a.id,
          )
        : (b.accountIds ?? []);
      return json(await enqueueEnrichment(db, ids, { force: b.force }), { status: 202 });
    }
    case "pause":
    case "resume":
      await setSetting("enrichment.paused", b.action === "pause");
      return json({ paused: b.action === "pause" });
    case "cancel":
      return json(
        await db.enrichmentJob.updateMany({
          where: { status: "queued" },
          data: { status: "cancelled", finishedAt: new Date() },
        }),
      );
    case "retry-failed":
      return json(
        await db.enrichmentJob.updateMany({
          where: { status: "failed" },
          data: { status: "queued", attempts: 0, error: null },
        }),
      );
    case "clear-finished":
      return json(
        await db.enrichmentJob.deleteMany({ where: { status: { in: ["done", "cancelled"] } } }),
      );
  }
});
