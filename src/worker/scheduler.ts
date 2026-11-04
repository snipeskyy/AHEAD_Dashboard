import type { PrismaClient } from "@prisma/client";
import type { DataAdapter, NormalizedSignal } from "../lib/adapters/types";
import { readSetting } from "../lib/settings/store";
import { isAdapterEnabled, runAdapter, type RunOutcome } from "./run-adapter";

const MAX_BACKOFF_MS = 6 * 3600_000;

/**
 * In-worker scheduler. Every tick it runs each enabled adapter whose interval has elapsed.
 * Adapters that keep failing back off exponentially (interval × 2^failures, capped at 6 h).
 */
export function createScheduler(
  db: PrismaClient,
  adapters: DataAdapter<NormalizedSignal, unknown>[],
  log: (...a: unknown[]) => void,
) {
  const lastRun = new Map<string, number>();
  const failures = new Map<string, number>();

  async function due(adapter: DataAdapter<NormalizedSignal, unknown>, now: number) {
    const minutes = await readSetting(db, "scheduler.intervalMinutes");
    const base = minutes * 60_000;
    const f = failures.get(adapter.id) ?? 0;
    const wait = f ? Math.min(MAX_BACKOFF_MS, base * 2 ** f) : base;
    return now - (lastRun.get(adapter.id) ?? 0) >= wait;
  }

  async function runOne(
    adapter: DataAdapter<NormalizedSignal, unknown>,
    accountId?: string,
  ): Promise<RunOutcome> {
    lastRun.set(adapter.id, Date.now());
    const out = await runAdapter(db, adapter, { accountId, log: (m) => log(m) });
    if (out.ok) failures.delete(adapter.id);
    else failures.set(adapter.id, (failures.get(adapter.id) ?? 0) + 1);
    if (out.skipped) return out;
    log(
      `${adapter.id}: ${out.ok ? `+${out.result?.inserted ?? 0} new (${out.result?.duplicates ?? 0} dup, ${out.result?.evidence ?? 0} evidence, ${out.result?.alerts ?? 0} alerts)` : `failed — ${out.error}`}`,
    );
    return out;
  }

  return {
    /** Scheduled pass: only adapters that are enabled and due. */
    async tick() {
      const now = Date.now();
      for (const a of adapters) {
        if (!(await isAdapterEnabled(db, a))) continue;
        if (await due(a, now)) await runOne(a);
      }
    },
    /** "Fetch now": ignores interval and backoff. */
    async fetchNow(opts: { adapterId?: string; accountId?: string }) {
      const outs: RunOutcome[] = [];
      for (const a of adapters) {
        if (opts.adapterId && a.id !== opts.adapterId) continue;
        if (!(await isAdapterEnabled(db, a))) continue;
        outs.push(await runOne(a, opts.accountId));
      }
      return outs;
    },
    state: () => ({ lastRun: Object.fromEntries(lastRun), failures: Object.fromEntries(failures) }),
  };
}
