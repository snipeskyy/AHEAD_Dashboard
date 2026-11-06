/**
 * Runs enrichers for one account, and drains the bulk queue (worker only; never in the browser).
 * Each enricher run is recorded (EnrichmentRun) so status, staleness and errors are visible per account.
 */
import type { PrismaClient } from "@prisma/client";
import type { AccountSourceConfig } from "@/lib/adapters/types";
import { readSetting } from "@/lib/settings/store";
import { createEnrichHttp, enrichUserAgent } from "./http";
import { blockedReason, enabledEnrichers } from "./registry";
import { recordResult } from "./store";
import {
  JOB_BOARD_PROVIDERS,
  type AccountIdentity,
  type EnrichContext,
  type Enricher,
} from "./types";

const DAY = 86_400_000;
const RETRY_FAILED_AFTER = 3_600_000;
const MAX_ATTEMPTS = 3;

export async function loadIdentity(
  db: PrismaClient,
  accountId: string,
): Promise<AccountIdentity | null> {
  const a = await db.account.findUnique({
    where: { id: accountId },
    include: {
      fields: {
        where: { field: { in: ["identity.legalName", "web.jobBoard", "web.newsroomRss"] } },
      },
    },
  });
  if (!a) return null;
  const f = Object.fromEntries(a.fields.map((x) => [x.field, x.value]));
  const cfg = (a.sourceConfig ?? {}) as AccountSourceConfig & Record<string, unknown>;
  const board =
    (f["web.jobBoard"] as AccountIdentity["jobBoard"]) ??
    JOB_BOARD_PROVIDERS.map((p) =>
      cfg[`${p}Slug`] ? { provider: p, slug: String(cfg[`${p}Slug`]) } : null,
    ).find(Boolean) ??
    null;
  return {
    accountId: a.id,
    name: a.name,
    legalName: (f["identity.legalName"] as string) ?? null,
    domain: a.domain,
    ticker: a.ticker,
    cik: a.cik,
    lei: a.lei,
    wikidataId: a.wikidataId,
    jobBoard: board,
    newsroomRss: (f["web.newsroomRss"] as string) ?? cfg.rssFeeds?.[0] ?? null,
    confirmedByUser: !!a.identityConfirmedAt,
    isDemo: a.isDemo,
  };
}

function isDue(
  e: Enricher,
  last: { finishedAt: Date | null; ok: boolean } | null,
  now: Date,
  force: boolean,
) {
  if (force || !last?.finishedAt) return true;
  const age = now.getTime() - last.finishedAt.getTime();
  return last.ok ? age > e.ttlDays * DAY : age > RETRY_FAILED_AFTER;
}

export interface AccountRunSummary {
  ran: Array<{ id: string; ok: boolean; applied: number; pending: number; error?: string }>;
  skipped: Array<{ id: string; reason: string }>;
}

export async function enrichAccount(
  db: PrismaClient,
  accountId: string,
  opts: {
    enricherIds?: string[] | null;
    force?: boolean;
    log?: (m: string) => void;
    timeoutMs?: number;
  } = {},
): Promise<AccountRunSummary> {
  const log = opts.log ?? (() => {});
  const env = {
    userAgent: enrichUserAgent(),
    secUserAgent: process.env.SEC_USER_AGENT?.trim() || null,
  };
  const autoApply = await readSetting(db, "enrichment.autoApply");
  const list = (await enabledEnrichers(db)).filter(
    (e) => !opts.enricherIds?.length || opts.enricherIds.includes(e.id),
  );
  const out: AccountRunSummary = { ran: [], skipped: [] };

  for (const e of list) {
    // Reload each time: earlier enrichers can fill identifiers later ones need (domain → job board, CIK, LEI).
    const identity = await loadIdentity(db, accountId);
    if (!identity) break;
    const blocked = blockedReason(e, identity, env);
    if (blocked) {
      out.skipped.push({ id: e.id, reason: blocked });
      continue;
    }
    const now = new Date();
    const last = await db.enrichmentRun.findFirst({
      where: { accountId, enricherId: e.id },
      orderBy: { startedAt: "desc" },
    });
    if (!isDue(e, last, now, !!opts.force)) {
      out.skipped.push({ id: e.id, reason: "Fresh (within TTL)" });
      continue;
    }
    const run = await db.enrichmentRun.create({
      data: { accountId, enricherId: e.id, startedAt: now },
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 180_000);
    const ctx: EnrichContext = {
      db,
      now,
      signal: ctrl.signal,
      env,
      log: (m) => log(`${e.id}: ${m}`),
      http: createEnrichHttp(
        db,
        e.needsSecUserAgent ? env.secUserAgent! : env.userAgent,
        ctrl.signal,
      ),
    };
    try {
      const result = await e.run(identity, ctx);
      const r = await recordResult(db, accountId, e.id, e.source, result, { autoApply, now });
      await db.enrichmentRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: true, proposals: result.proposals.length },
      });
      out.ran.push({ id: e.id, ok: true, ...r });
    } catch (err) {
      const msg = (
        ctrl.signal.aborted ? "Timed out" : err instanceof Error ? err.message : String(err)
      ).slice(0, 500);
      await db.enrichmentRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: false, error: msg },
      });
      out.ran.push({ id: e.id, ok: false, applied: 0, pending: 0, error: msg });
      log(`${e.id} failed: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
}

/** Queue jobs for accounts (skips accounts that already have a queued/running job). */
export async function enqueueEnrichment(
  db: PrismaClient,
  accountIds: string[],
  opts: { enricherIds?: string[] | null; force?: boolean } = {},
) {
  const busy = new Set(
    (
      await db.enrichmentJob.findMany({
        where: { accountId: { in: accountIds }, status: { in: ["queued", "running"] } },
        select: { accountId: true },
      })
    ).map((j) => j.accountId),
  );
  const real = await db.account.findMany({
    where: { id: { in: accountIds }, isDemo: false },
    select: { id: true },
  });
  const ids = real.map((a) => a.id).filter((id) => !busy.has(id));
  if (ids.length)
    await db.enrichmentJob.createMany({
      data: ids.map((accountId) => ({
        accountId,
        enricherIds: opts.enricherIds?.length ? opts.enricherIds : undefined,
        force: !!opts.force,
      })),
    });
  return { queued: ids.length, alreadyQueued: busy.size };
}

/** One worker tick: run up to `concurrency` queued jobs in parallel unless paused. */
export async function drainEnrichmentQueue(db: PrismaClient, log: (...a: unknown[]) => void) {
  if (await readSetting(db, "enrichment.paused")) return 0;
  const n = await readSetting(db, "enrichment.concurrency");
  const jobs = await db.enrichmentJob.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: n,
  });
  await Promise.all(
    jobs.map(async (job) => {
      await db.enrichmentJob.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
      });
      try {
        const s = await enrichAccount(db, job.accountId, {
          enricherIds: (job.enricherIds as string[] | null) ?? null,
          force: job.force,
          log: (m) => log("[enrich]", m),
        });
        const failed = s.ran.filter((r) => !r.ok);
        await db.enrichmentJob.update({
          where: { id: job.id },
          data: {
            status: failed.length && failed.length === s.ran.length ? "failed" : "done",
            finishedAt: new Date(),
            error: failed.length
              ? failed
                  .map((f) => `${f.id}: ${f.error}`)
                  .join("; ")
                  .slice(0, 1000)
              : null,
          },
        });
        log(
          "[enrich]",
          job.accountId,
          `ran ${s.ran.length}, skipped ${s.skipped.length}, failed ${failed.length}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await db.enrichmentJob.update({
          where: { id: job.id },
          data: {
            status: job.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "queued",
            error: msg.slice(0, 1000),
            finishedAt: new Date(),
          },
        });
      }
    }),
  );
  return jobs.length;
}

/** Daily: re-queue already-enriched accounts whose enrichers passed their TTL. */
export async function queueStaleRefresh(db: PrismaClient) {
  if (!(await readSetting(db, "enrichment.autoRefresh"))) return 0;
  const enriched = await db.enrichmentRun.findMany({
    where: { ok: true },
    distinct: ["accountId"],
    select: { accountId: true },
  });
  const now = new Date();
  const enabled = await enabledEnrichers(db);
  const stale: string[] = [];
  for (const { accountId } of enriched) {
    const runs = await db.enrichmentRun.findMany({
      where: { accountId, ok: true },
      orderBy: { startedAt: "desc" },
    });
    const latest = new Map<string, Date>();
    for (const r of runs)
      if (!latest.has(r.enricherId) && r.finishedAt) latest.set(r.enricherId, r.finishedAt);
    if (
      enabled.some(
        (e) => latest.has(e.id) && now.getTime() - latest.get(e.id)!.getTime() > e.ttlDays * DAY,
      )
    )
      stale.push(accountId);
  }
  return (await enqueueEnrichment(db, stale)).queued;
}
