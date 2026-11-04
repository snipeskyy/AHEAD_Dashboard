import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

/**
 * Full JSON snapshot of every user-data table (local only; nothing leaves the machine).
 * Caches and job bookkeeping (HttpCache, JobRequest, SourceRun) are intentionally excluded.
 */
export async function snapshotAll(db: PrismaClient) {
  const tables = {
    accounts: db.account.findMany(),
    contacts: db.contact.findMany(),
    practiceStatus: db.accountPracticeStatus.findMany(),
    initiatives: db.initiative.findMany(),
    techStack: db.techStackHypothesis.findMany(),
    signals: db.signal.findMany(),
    opportunities: db.opportunity.findMany(),
    stageChanges: db.stageChange.findMany(),
    plays: db.play.findMany(),
    campaigns: db.campaign.findMany(),
    touches: db.touch.findMany(),
    events: db.event.findMany(),
    eventInvites: db.eventInvite.findMany(),
    planItems: db.accountPlanItem.findMany(),
    notes: db.note.findMany(),
    activity: db.activityLog.findMany(),
    notifications: db.notification.findMany(),
    savedViews: db.savedView.findMany(),
    layouts: db.dashboardLayout.findMany(),
    settings: db.setting.findMany(),
    exportTemplates: db.exportTemplate.findMany(),
    exportJobs: db.exportJob.findMany(),
    sandboxScenarios: db.sandboxScenario.findMany(),
    importBatches: db.importBatch.findMany(),
    importRecords: db.importRecord.findMany(),
    importMappings: db.importMapping.findMany(),
    partnerReps: db.partnerRep.findMany(),
    partnerRepAccounts: db.partnerRepAccount.findMany(),
  };
  const keys = Object.keys(tables) as Array<keyof typeof tables>;
  const values = await Promise.all(keys.map((k) => tables[k]));
  const data = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
  return { format: "acc-backup", version: 2, exportedAt: new Date().toISOString(), data };
}

export const BACKUP_DIR = path.join(process.cwd(), "backups");

/** Writes `backups/<label>-<timestamp>.json` and returns its path. */
export async function writeBackupFile(db: PrismaClient, label: string) {
  const snap = await snapshotAll(db);
  await mkdir(BACKUP_DIR, { recursive: true });
  const stamp = snap.exportedAt.replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `${label}-${stamp}.json`);
  await writeFile(file, JSON.stringify(snap));
  return file;
}
