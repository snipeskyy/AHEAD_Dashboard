/**
 * Background worker (separate process; started by `npm run dev` alongside Next).
 * Runs the public-source adapters on a schedule, processes "Fetch now" jobs, and rescores
 * signal relevance. Talks to the web app only through the database.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { z } from "zod";
import { SIGNAL_ADAPTERS } from "../lib/adapters";
import { computeScoresForAccounts } from "../lib/scoring/account-scores";
import { createSqliteSearchProvider } from "../lib/search/sqlite-provider";
import { rescoreSignals, retagSignals } from "./rescore";
import { createScheduler } from "./scheduler";

const db = new PrismaClient();
const log = (...a: unknown[]) =>
  console.log(`[worker ${new Date().toISOString().slice(11, 19)}]`, ...a);
const scheduler = createScheduler(db, SIGNAL_ADAPTERS, log);

const FetchPayload = z
  .object({ adapterId: z.string().optional(), accountId: z.string().optional() })
  .nullish();

type JobHandler = (payload: unknown) => Promise<string | { message: string; result: unknown }>;
const handlers: Partial<Record<string, JobHandler>> = {
  "recompute-scores": async () => {
    await computeScoresForAccounts(db, { now: new Date() });
    return "account scores recomputed";
  },
  "rescore-signals": async () => `rescored ${await rescoreSignals(db, new Date())} signals`,
  "retag-signals": async () => `re-tagged ${await retagSignals(db, new Date())} signals`,
  "fetch-now": async (payload) => {
    const p = FetchPayload.parse(payload) ?? {};
    const outs = await scheduler.fetchNow(p);
    const result = outs.map((o) => ({
      adapterId: o.adapterId,
      ok: o.ok,
      skipped: o.skipped ?? null,
      inserted: o.result?.inserted ?? 0,
      duplicates: o.result?.duplicates ?? 0,
      error: o.error ?? null,
    }));
    return {
      result,
      message:
        outs
          .map(
            (o) =>
              `${o.adapterId}:${o.ok ? (o.skipped ?? `+${o.result?.inserted ?? 0}`) : "error"}`,
          )
          .join(", ") || "no enabled adapters",
    };
  },
};

async function drainJobs() {
  const jobs = await db.jobRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  for (const job of jobs) {
    const h = handlers[job.kind];
    await db.jobRequest.update({ where: { id: job.id }, data: { status: "running" } });
    try {
      const out = h ? await h(job.payload) : `no handler for ${job.kind}`;
      const msg = typeof out === "string" ? out : out.message;
      await db.jobRequest.update({
        where: { id: job.id },
        data: {
          status: h ? "done" : "failed",
          finishedAt: new Date(),
          result: (typeof out === "string"
            ? { message: out }
            : { message: out.message, sources: out.result }) as Prisma.InputJsonValue,
        },
      });
      log(job.kind, "→", msg);
    } catch (e) {
      await db.jobRequest.update({
        where: { id: job.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          result: { message: e instanceof Error ? e.message : String(e) },
        },
      });
      log(job.kind, "failed:", e instanceof Error ? e.message : e);
    }
  }
}

async function main() {
  await createSqliteSearchProvider(db).ensureReady();
  // Jobs left "running" by a previous crash go back to pending.
  await db.jobRequest.updateMany({ where: { status: "running" }, data: { status: "pending" } });
  log(
    `started — ${SIGNAL_ADAPTERS.length} adapters; public fetch ${process.env.PUBLIC_FETCH_ENABLED === "false" ? "DISABLED" : "enabled"}`,
  );
  let busy = false;
  const guarded = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch (e) {
      log("error", e instanceof Error ? e.message : e);
    } finally {
      busy = false;
    }
  };
  setInterval(() => guarded(drainJobs), 2_000);
  setInterval(() => guarded(() => scheduler.tick()), 30_000);
  setTimeout(() => guarded(() => scheduler.tick()), 8_000);
  // Relevance decays with time; refresh stored scores hourly (and once at boot).
  const rescore = () =>
    guarded(async () => log(`rescored ${await rescoreSignals(db, new Date())} signals`));
  setTimeout(rescore, 5_000);
  setInterval(rescore, 60 * 60_000);
}

process.on("SIGINT", () => db.$disconnect().finally(() => process.exit(0)));
process.on("SIGTERM", () => db.$disconnect().finally(() => process.exit(0)));
main();
