/**
 * Background worker (separate process; started by `npm run dev` alongside Next).
 * Phase 1: job queue + periodic rescoring. Phase 3 adds the public-source adapters.
 * Communicates with the web app only through the database (JobRequest, Signal, SourceRun rows).
 */
import { PrismaClient } from "@prisma/client";
import { computeScoresForAccounts } from "../lib/scoring/account-scores";
import { createSqliteSearchProvider } from "../lib/search/sqlite-provider";
import { rescoreSignals } from "./rescore";

const db = new PrismaClient();
const log = (...a: unknown[]) =>
  console.log(`[worker ${new Date().toISOString().slice(11, 19)}]`, ...a);

type JobHandler = (payload: unknown) => Promise<string>;
const handlers: Partial<Record<string, JobHandler>> = {
  "recompute-scores": async () => {
    await computeScoresForAccounts(db, { now: new Date() });
    return "account scores recomputed";
  },
  "rescore-signals": async () => `rescored ${await rescoreSignals(db, new Date())} signals`,
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
      const msg = h ? await h(job.payload) : `no handler for ${job.kind}`;
      await db.jobRequest.update({
        where: { id: job.id },
        data: { status: h ? "done" : "failed" },
      });
      log(job.kind, "→", msg);
    } catch (e) {
      await db.jobRequest.update({ where: { id: job.id }, data: { status: "failed" } });
      log(job.kind, "failed:", e instanceof Error ? e.message : e);
    }
  }
}

async function main() {
  await createSqliteSearchProvider(db).ensureReady();
  log("started");
  let busy = false;
  const tick = async (fn: () => Promise<unknown>) => {
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
  setInterval(() => tick(drainJobs), 2_000);
  // Relevance decays with time; refresh stored scores hourly (and once at boot).
  const rescore = () =>
    tick(async () => log(`rescored ${await rescoreSignals(db, new Date())} signals`));
  setTimeout(rescore, 5_000);
  setInterval(rescore, 60 * 60_000);
}

process.on("SIGINT", () => db.$disconnect().finally(() => process.exit(0)));
process.on("SIGTERM", () => db.$disconnect().finally(() => process.exit(0)));
main();
