import type { PrismaClient } from "@prisma/client";
import { SOURCE_CATALOG } from "../lib/adapters/catalog";
import {
  AdapterNotConfiguredError,
  type AdapterAccount,
  type AccountSourceConfig,
  type DataAdapter,
  type NormalizedSignal,
} from "../lib/adapters/types";
import { ingestSignals, type IngestResult } from "../lib/ingest/ingest";
import { computeScoresForAccounts } from "../lib/scoring/account-scores";
import { readSetting } from "../lib/settings/store";

export async function loadAdapterAccounts(
  db: PrismaClient,
  accountId?: string,
): Promise<AdapterAccount[]> {
  const rows = await db.account.findMany({
    where: { id: accountId },
    select: {
      id: true,
      name: true,
      domain: true,
      ticker: true,
      cik: true,
      isDemo: true,
      tier: true,
      sourceConfig: true,
    },
  });
  return rows.map((r) => ({ ...r, sourceConfig: (r.sourceConfig ?? {}) as AccountSourceConfig }));
}

export async function isAdapterEnabled(
  db: PrismaClient,
  adapter: DataAdapter<NormalizedSignal, unknown>,
): Promise<boolean> {
  if (adapter.kind === "private-future") return false;
  const enabled = await readSetting(db, "sources.enabled");
  const def = SOURCE_CATALOG.find((s) => s.id === adapter.id)?.defaultEnabled ?? false;
  if (!(enabled[adapter.id] ?? def)) return false;
  if (adapter.kind === "public" && process.env.PUBLIC_FETCH_ENABLED === "false") return false;
  return true;
}

export interface RunOutcome {
  adapterId: string;
  ok: boolean;
  skipped?: string;
  result?: IngestResult;
  error?: string;
}

/** Runs one adapter end-to-end and records a SourceRun row (the per-source health indicator). */
export async function runAdapter(
  db: PrismaClient,
  adapter: DataAdapter<NormalizedSignal, unknown>,
  opts: { accountId?: string; log: (m: string) => void; timeoutMs?: number },
): Promise<RunOutcome> {
  const accounts = (await loadAdapterAccounts(db, opts.accountId)).filter(
    (a) => adapter.eligible?.(a) ?? true,
  );
  if (!accounts.length && adapter.kind !== "private-future")
    return { adapterId: adapter.id, ok: true, skipped: "no eligible accounts" };
  const run = await db.sourceRun.create({
    data: { adapterId: adapter.id, startedAt: new Date(), ok: false },
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 5 * 60_000);
  try {
    const now = new Date();
    const items = await adapter.fetch({
      db,
      accounts,
      now,
      signal: ctrl.signal,
      env: { secUserAgent: process.env.SEC_USER_AGENT?.trim() || null },
      log: opts.log,
    });
    const result = await ingestSignals(db, items, now);
    await db.sourceRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, itemsNew: result.inserted },
    });
    if (result.inserted) {
      const touched = [...new Set(items.map((i) => i.accountId))];
      await computeScoresForAccounts(db, { now: new Date(), accountIds: touched });
    }
    return { adapterId: adapter.id, ok: true, result };
  } catch (e) {
    const msg =
      e instanceof AdapterNotConfiguredError
        ? e.message
        : e instanceof Error
          ? `${e.name === "AbortError" ? "Timed out" : e.message}`
          : String(e);
    await db.sourceRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: msg.slice(0, 500) },
    });
    return { adapterId: adapter.id, ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
