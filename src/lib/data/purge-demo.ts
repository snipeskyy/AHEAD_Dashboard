import { rm } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { createSqliteSearchProvider } from "@/lib/search/sqlite-provider";

export interface DemoCounts {
  accounts: number;
  opportunities: number;
  signals: number;
  touches: number;
  campaigns: number;
  events: number;
  plays: number;
}

export async function countDemo(db: PrismaClient): Promise<DemoCounts> {
  const w = { where: { isDemo: true } };
  const [accounts, opportunities, signals, touches, campaigns, events, plays] = await Promise.all([
    db.account.count(w),
    db.opportunity.count(w),
    db.signal.count(w),
    db.touch.count(w),
    db.campaign.count(w),
    db.event.count(w),
    db.play.count(w),
  ]);
  return { accounts, opportunities, signals, touches, campaigns, events, plays };
}

export const hasDemo = (c: DemoCounts) => Object.values(c).some((n) => n > 0);

const ids = async (rows: Promise<Array<{ id: string }>>) => (await rows).map((r) => r.id);

/** Splits large `IN (...)` lists so SQLite's variable limit is never hit. */
async function inChunks(values: string[], fn: (chunk: string[]) => Promise<unknown>) {
  for (let i = 0; i < values.length; i += 500) await fn(values.slice(i, i + 500));
}

/**
 * Deletes every demo record (isDemo rows plus the notes, activity, notifications and export
 * history that point at them). Demo plays are kept and relabeled as Starter Plays.
 * Real accounts and everything attached to them are untouched. Caller takes the backup first.
 */
export async function purgeDemoData(db: PrismaClient, opts: { exportsDir?: string } = {}) {
  const before = await countDemo(db);
  const w = { where: { isDemo: true }, select: { id: true } } as const;
  const [accountIds, oppIds, signalIds, eventIds, campaignIds] = await Promise.all([
    ids(db.account.findMany(w)),
    ids(db.opportunity.findMany(w)),
    ids(db.signal.findMany(w)),
    ids(db.event.findMany(w)),
    ids(db.campaign.findMany(w)),
  ]);
  const demoEntityIds = [...accountIds, ...oppIds, ...signalIds, ...eventIds, ...campaignIds];
  const demoAccounts = new Set(accountIds);

  const search = createSqliteSearchProvider(db);
  await search.drop(); // bulk deletes would otherwise fire one FTS trigger per row

  let notes = (await db.note.deleteMany({ where: { id: { startsWith: "demo-" } } })).count;
  let activity = (
    await db.activityLog.deleteMany({
      where: { OR: [{ id: { startsWith: "demo-" } }, { action: "demo.reset" }] },
    })
  ).count;
  await inChunks(demoEntityIds, async (chunk) => {
    notes += (await db.note.deleteMany({ where: { entityId: { in: chunk } } })).count;
    activity += (await db.activityLog.deleteMany({ where: { entityId: { in: chunk } } })).count;
  });
  const notifications = (
    await db.notification.deleteMany({
      where: { OR: [{ id: { startsWith: "demo-" } }, { href: { contains: "demo-" } }] },
    })
  ).count;

  // Export history built from demo accounts (explicit scope or a portfolio scope while demo existed).
  const jobs = await db.exportJob.findMany({ select: { id: true, config: true } });
  const demoJobs = jobs.filter((j) => {
    const scope = (j.config as { scope?: { type?: string; accountIds?: string[] } })?.scope;
    if (!scope) return false;
    if (scope.type === "portfolio") return demoAccounts.size > 0;
    return (scope.accountIds ?? []).some((id) => demoAccounts.has(id));
  });
  await db.exportJob.deleteMany({ where: { id: { in: demoJobs.map((j) => j.id) } } });
  const dir = opts.exportsDir ?? path.join(process.cwd(), "exports");
  for (const j of demoJobs)
    for (const ext of [".json", ".pdf", ".md", ".pptx"])
      await rm(path.join(dir, `${j.id}${ext}`), { force: true });

  await db.touch.deleteMany({ where: { isDemo: true } });
  await db.campaign.deleteMany({ where: { isDemo: true } });
  await db.eventInvite.deleteMany({ where: { account: { isDemo: true } } });
  await db.event.deleteMany({ where: { isDemo: true } });
  await db.signal.deleteMany({ where: { isDemo: true } });
  await db.opportunity.deleteMany({ where: { isDemo: true } });
  await db.account.deleteMany({ where: { isDemo: true } }); // cascades contacts, plans, …
  await db.sourceRun.deleteMany({ where: { adapterId: "seed" } });
  const starter = await db.play.updateMany({
    where: { isDemo: true },
    data: { isDemo: false, origin: "starter" },
  });

  await search.ensureReady(); // recreate + rebuild from the remaining rows
  return {
    removed: { ...before, plays: 0, notes, activity, notifications, exportJobs: demoJobs.length },
    starterPlays: starter.count,
  };
}
